import Layer_t from './Layer.js'
import PopImage from './PopEngine/PopWebImageApi.js'
import {CreateBlitQuadGeometry} from './PopEngine/CommonGeometry.js'

const Frag_Blit = `
precision highp float;
varying vec2 FragUv;
uniform sampler2D PreviousLayerImage;
void main()
{
	gl_FragColor = texture2D( PreviousLayerImage, FragUv );
}
`;

const DefaultVert = `
precision highp float;
varying vec2 FragUv;
uniform vec4 Rect;	//	Visible:false
attribute vec2 LocalPosition;
void main()
{
	vec2 xy = mix( Rect.xy, Rect.xy+Rect.zw, LocalPosition );
	xy = mix( vec2(-1), vec2(1), xy );
	FragUv = LocalPosition;
	gl_Position = vec4( xy, 0.5, 1.0 );
}
`;



export default class LayerFrag extends Layer_t
{
	constructor()
	{
		super();
		
		this.VertSource = DefaultVert;
		this.FragSource = Frag_Blit;
		this.TargetImage = null;
		this.Shader = null;
		this.Geometry = null;
		
		this.NewFragSource = null;
		this.ClearColour = [0,0,0,0];
		
		this.UserUniforms = {};
		this.BuiltInUniforms = [
		//'PreviousLayerImage'
		'FragSource',
		'FrameTimeMs',
		];
		this.HiddenUniformTypes = [
		'sampler2D','sampler3D',
		'vec2','vec3','vec4',
		];
	}
	
	set Frag(Source)
	{
		this.NewFragSource = Source;
	}
	
	GetUniforms()
	{
		const Uniforms = {};
		
		//	insert auto-detected uniforms
		if ( this.Shader )
		{
			const UniformMetas = this.Shader.UniformMetas;
			for ( let UniformName in UniformMetas )
			{
				const Meta = UniformMetas[UniformName];
				if ( this.HiddenUniformTypes.includes( Meta.Type ) )
					continue;
				Uniforms[UniformName] = Meta.default || 0;//todo: get default from comment
			}
		}
		
		Object.assign( Uniforms, this.UserUniforms );
		
		this.BuiltInUniforms.forEach( biu => delete Uniforms[biu] );
		
		Uniforms.FragSource = this.NewFragSource || this.FragSource;
		return Uniforms;
	}
	
	GetUniformMetas()
	{
		const Metas = super.GetUniformMetas();
		//	find any meta from shader comments!
		if ( this.Shader )
		{
			const UniformMetas = this.Shader.UniformMetas;
			for ( let UniformName in UniformMetas )
			{
				const Meta = Metas[UniformName];
				if ( !Meta )
					continue;
				const ShaderMeta = UniformMetas[UniformName];
				Object.assign( Meta, ShaderMeta );
			}
		}
		return Metas;
	}
	
	SetUniforms(Uniforms)
	{
		//	detect source change
		if ( Uniforms.FragSource != this.NewFragSource || this.FragSource )
			this.Frag = Uniforms.FragSource;
		
		//	save values
		Object.assign(this.UserUniforms,Uniforms);
		
		//	delete built-in uniforms
		this.BuiltInUniforms.forEach( biu => delete this.UserUniforms[biu] );
	}
	
	GetTargetImage()
	{
		if ( !this.TargetImage )
		{
			const Meta = this.GetOutputMeta();
			this.TargetImage = new PopImage();
			const Buffer = new Float32Array( Meta.Width * Meta.Height * 4 );
			this.TargetImage.WritePixels( Meta.Width, Meta.Height, Buffer, Meta.PixelFormat );
		}
		return this.TargetImage;
	}
	
	async GetGeometry(RenderContext)
	{
		if ( !this.Geometry )
		{
			const Quad = CreateBlitQuadGeometry([0,0,1,1],'LocalPosition');
			this.Geometry = await RenderContext.CreateGeometry( Quad );
		}
		return this.Geometry;
	}
	
	async GetShader(RenderContext)
	{
		//	shader dirty
		if ( this.NewFragSource )
		{
			if ( this.Shader )
			{
				this.Shader.Free();
				this.Shader = null;
			}
			this.FragSource = this.NewFragSource;
			this.NewFragSource = null;
		}
		
		if ( !this.Shader )
		{
			const Macros = {};
			try
			{
				this.Shader = await RenderContext.CreateShader( this.VertSource, this.FragSource, Macros );
			}
			catch(e)
			{
				//	todo:
				console.warn(e);
			}
		}
		return this.Shader;
	}
	
	async GetRenderCommands(RenderUniforms,RenderContext,Target=undefined,ReadBackTarget=true)
	{
		//	null is a valid target! (screen)
		if ( Target === undefined )
			throw `No target specified`;
			
		let Uniforms = {};
		let LayerUniforms = this.GetUniforms();
		Object.assign( Uniforms, LayerUniforms );
		Object.assign( Uniforms, RenderUniforms );
		
		const FrameTimeMs = Uniforms.FrameTimeMs;
		const TimeNorm = (FrameTimeMs/1000) % 1;
		//const ClearColour = [0,TimeNorm,1,0.5];
		//const ClearColour = [1,0,0,1];
		//const ClearColour = [0,0,0,0];
		const ClearColour = this.ClearColour;
		const ReadBack = (Target!=null) ? ReadBackTarget : undefined;	//	need to readback for thumbnails in app
		const Clear = ['SetRenderTarget',Target, ClearColour, ReadBack ];

		const Rect = [0,0,1,1];
		Uniforms.Rect = Rect;
		const Geo = await this.GetGeometry(RenderContext);
		const Shader = await this.GetShader(RenderContext);
		const State = {};
		State.DepthRead = false;
		State.DepthWrite = false;
		
		const Draw = ['Draw', Geo, Shader, Uniforms, State ];
		return [Clear,Draw];
	}
	
	async GetImage(FrameTimeMs,RenderUniforms,RenderContext,NeedCpuPixels)
	{
		//	generate commands
		let Uniforms = {};
		Object.assign( Uniforms, RenderUniforms );
		Uniforms.FrameTimeMs = FrameTimeMs;
		
		//	render
		const TargetImage = await this.GetTargetImage();
		const RenderCommands = await this.GetRenderCommands( Uniforms, RenderContext, TargetImage, NeedCpuPixels );
		await RenderContext.Render( RenderCommands );
		
		return TargetImage;
	}
}

