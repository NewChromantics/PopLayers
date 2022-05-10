import Layer_t from './Layer.js'
import Pop from './PopEngine/PopEngine.js'
import Layer_Frag from './LayerFrag.js'

class LayerRenderer
{
	constructor(Canvas)
	{
		this.RenderView = new Pop.Gui.RenderView( null, Canvas );
		this.RenderContext = new Pop.Sokol.Context( this.RenderView );
		
		this.BlitToScreenLayer = new Layer_Frag();
	}
	
	GetRenderCommands(FrameTimeMs)
	{
		const TimeNorm = (FrameTimeMs/1000) % 1;
		const Clear = ['SetRenderTarget',null,[0,TimeNorm,1,0.5] ];
		return [Clear];
	}
	
	async Render(FrameTimeMs,LayerCount,GetLayer,OnLayerProducedImage)
	{
		//	render each layer
		let Uniforms = {};
		Uniforms.PreviousLayerImage = null;
		for ( let l=0;	l<LayerCount;	l++ )
		{
			const Layer = GetLayer(l);
			const LayerOutput = await Layer.GetImage( FrameTimeMs, Uniforms, this.RenderContext );
			
			//	maybe this should be layer->promise?
			OnLayerProducedImage( l, LayerOutput );
			
			Uniforms.PreviousLayerImage = LayerOutput;
		}
		
		//	render final layer image to screen
		//	this is an extra blit we probably don't need...
		//	but maybe we'll want a final "blit" layer per device (eg. output to YUV)
		{
			const FinalRenderUniforms = {};
			FinalRenderUniforms.FrameTimeMs = FrameTimeMs;
			const FinalRenderTarget = null;	//	screen
			const FinalRenderCommands = await this.BlitToScreenLayer.GetRenderCommands( FinalRenderUniforms, this.RenderContext, FinalRenderTarget );
			await this.RenderContext.Render( FinalRenderCommands );
		}
	}
}

export default class LayerManager
{
	constructor(Canvas)
	{
		this.Renderer = new LayerRenderer(Canvas);
		this.Layers = [];
	}
	
	InsertLayer(Layer,Position)
	{
		if ( !(Layer instanceof Layer_t) )
			throw `Layer is not a layer`;
		this.Layers.splice( Position, 0, Layer );
	}
	
	//	dirty a layer (do we need ids for layers here?)
	OnLayerChanged(Layer)
	{
		//	mark all layers after Layer as needing re-rendering [for the last frame-time]
	}
	
	async Render(FrameTimeMs,OnLayerProducedImage)
	{
		function GetLayer(Index)
		{
			return this.Layers[Index];
		}
		await this.Renderer.Render( FrameTimeMs, this.Layers.length, GetLayer.bind(this), OnLayerProducedImage );
	}
}