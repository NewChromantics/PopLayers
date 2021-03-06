
export class UnsupportedLayerType
{
	constructor(TypeName)
	{
		this.TypeName = TypeName;
		
		//	save & load same uniforms
		this.Uniforms = {};
	}
	
	GetUniforms()
	{
		return this.Uniforms;
	}
	
	async SetUniforms(NewUniforms)
	{
		this.Uniforms = NewUniforms;
	}
	
	GetState()
	{
		const State = {};
		State.Error = `Unsupported type ${this.TypeName}`;
		return State;
	}
	
	get FactoryTypeName()
	{
		return this.TypeName;
	}
	
	async GetImage(FrameTimeMs,RenderContext)
	{
		throw this.GetState().Error;
	}
}

export default class Layer
{
	constructor()
	{
	}
	
	get FactoryTypeName()
	{
		return this.constructor.name;
	}
	
	//	here you can force certain meta like
	//		layer dimensions
	GetOutputMeta(PreviousLayerMeta={})
	{
		const Meta = {};
		Meta.Width = 256;
		Meta.Height = 256;
		Meta.PixelFormat = 'Float4';
		Object.assign( Meta, PreviousLayerMeta );
		return Meta;
	}
	
	GetState()
	{
		//	return .Error here
		return {};
	}
	
	//	parameters exposed to user
	//	todo: with frame number for setting keyframes?
	GetUniforms(ForSerialisation=false)
	{
		return {};
	}
	
	//	get [static/runtime] meta associated with values for UI purposes
	GetUniformMetas()
	{
		//	deafult makes everything writable
		const Uniforms = this.GetUniforms();
		const Metas = {};
		for ( let UniformName in Uniforms )
			Metas[UniformName] = { Writable:true };
		return Metas;
	}
	
	//	todo: with frame number for setting keyframes?
	async SetUniforms(Uniforms)
	{
		//	allow this to not-error if no uniforms provided
		if ( !Uniforms || Object.keys(Uniforms).length == 0 )
			return;
		throw `Handle new uniforms in layer class`
	}
	
	//	if this layer has specific frame times (eg. video)
	//	return them
	GetKeyframeTimes()
	{
		return null;
	}
	
	async GetImage(FrameTimeMs,RenderContext)
	{
		throw `Overload GetImage(); todo: auto invoke GetRenderCommands() and produce an image`;
	}
}

