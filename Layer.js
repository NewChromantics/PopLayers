
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
	
	//	parameters exposed to user
	//	todo: with frame number for setting keyframes?
	GetUniforms()
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
	SetUniforms(Uniforms)
	{
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

