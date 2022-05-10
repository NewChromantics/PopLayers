import Layer_t from './Layer.js'
import PopImage from './PopEngine/PopWebImageApi.js'

const DefaultFrag = `
precision highp float;
varying vec2 FragUv;
void main()
{
	gl_FragColor = vec4( FragUv, 0.0, 1.0 );
}
`;

const DefaultVert = `
precision highp float;
varying vec2 FragUv;
uniform vec4 Rect;
attribute vec2 LocalPosition;
void main()
{
	vec2 xy = mix( Rect.xy, Rect.xy+Rect.zw, LocalPosition );
	gl_Position = vec4( xy, 0.0, 1.0 );
}
`;



export default class LayerFrag extends Layer_t
{
	constructor()
	{
		super();
		
		this.VertSource = DefaultVert;
		this.FragSource = DefaultFrag;
		this.TargetImage = null;
		this.Shader = null;
		this.Geometry = null;
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
		}
		return this.Geometry;
	}
	
	async GetShader(RenderContext)
	{
		if ( !this.Shader )
		{
			const Macros = {};
			this.Shader = await RenderContext.CreateShader( this.VertSource, this.FragSource, Macros );
		}
		return this.Shader;
	}
	
	async GetRenderCommands(RenderUniforms,RenderContext,Target=undefined)
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
		const ClearColour = [0,TimeNorm,1,0.5];
		//const ClearColour = [1,0,0,1];
		const ReadBack = (Target!=null) ? true : undefined;	//	need to readback for thumbnails in app
		const Clear = ['SetRenderTarget',Target, ClearColour, ReadBack ];
	return [Clear];
		const Rect = [0,0,1,1];
		const Geo = await this.GetGeometry(RenderContext);
		const Shader = await this.GetShader(RenderContext);
		
		const Draw = ['Draw', Geo, Shader, Uniforms ];
		return [Clear,Draw];
	}
	
	async GetImage(FrameTimeMs,RenderUniforms,RenderContext)
	{
		//	generate commands
		let Uniforms = {};
		Object.assign( Uniforms, RenderUniforms );
		Uniforms.FrameTimeMs = FrameTimeMs;
		
		//	render
		const TargetImage = await this.GetTargetImage();
		const RenderCommands = await this.GetRenderCommands( Uniforms, RenderContext, TargetImage );
		await RenderContext.Render( RenderCommands );
		
		return TargetImage;
	}
}

