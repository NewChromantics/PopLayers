import Layer_t from './Layer.js'
import Pop from './PopEngine/PopEngine.js'
import Layer_Frag from './LayerFrag.js'
import Layer_DepthEstimate from './LayerDepthEstimate.js'
import Layer_Image from './LayerImage.js'
import {CreateColourTexture} from './PopEngine/Images.js'
import PromiseQueue from './PopEngine/PromiseQueue.js'


const LayerTypes = [
Layer_Frag,
Layer_DepthEstimate,
Layer_Image,
];

function GetDefaultLayerFactory()
{
	function CreateLayer(TypeName)
	{
		const TypeMatch = LayerTypes.find( lt => lt.prototype.constructor.name == TypeName );
		if ( !TypeMatch )
			throw `Unknown layer type ${TypeName}`;
		const NewLayer = new TypeMatch();
		return NewLayer;
	}
	return CreateLayer;
}


class LayerRenderer
{
	constructor(Canvas)
	{
		this.RenderView = new Pop.Gui.RenderView( null, Canvas );
		this.RenderContext = new Pop.Sokol.Context( this.RenderView );
		
		this.BlitToScreenLayer = new Layer_Frag();
		
		this.NullTexture = CreateColourTexture([0,0,0,0]);
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
		Uniforms.PreviousLayerImage = this.NullTexture;
		
		//	initialise output in case we dont reach the end
		if ( OnLayerProducedImage )
		{
			for ( let l=0;	l<LayerCount;	l++ )
				OnLayerProducedImage( l, null );
		}
		
		for ( let l=0;	l<LayerCount;	l++ )
		{
			const Layer = GetLayer(l);
			let LayerOutput;
			try
			{
				const ReadBackPixels = OnLayerProducedImage != null;
				LayerOutput = await Layer.GetImage( FrameTimeMs, Uniforms, this.RenderContext, ReadBackPixels );
			}
			catch(e)
			{
				console.warn(`Error rendering layer ${l}/${LayerCount}; ${e}`);
				
				//	slow down for things like compile errors
				await Pop.Yield(2*1000);
				break;
			}
			
			//	maybe this should be layer->promise?
			if ( OnLayerProducedImage )
				OnLayerProducedImage( l, LayerOutput );
			
			Uniforms.PreviousLayerImage = LayerOutput;
		}
		
		//	render final layer image to screen
		//	this is an extra blit we probably don't need...
		//	but maybe we'll want a final "blit" layer per device (eg. output to YUV)
		{
			const FinalRenderUniforms = {};
			FinalRenderUniforms.FrameTimeMs = FrameTimeMs;
			FinalRenderUniforms.PreviousLayerImage = Uniforms.PreviousLayerImage;
			const FinalRenderTarget = null;	//	screen
			const FinalRenderCommands = await this.BlitToScreenLayer.GetRenderCommands( FinalRenderUniforms, this.RenderContext, FinalRenderTarget );
			await this.RenderContext.Render( FinalRenderCommands );
		}
		
		//	would we be more efficient (neater code, less gl syncs) to readback all targets here
		//	once we know the screen has been resolved?
	}
}

export default class LayerManager
{
	constructor(Canvas,LayerFactory)
	{
		this.LayerFactory = LayerFactory || GetDefaultLayerFactory();
		this.Renderer = new LayerRenderer(Canvas);
		this.Layers = [];
		this.StructureChangeQueue = new PromiseQueue('LayerManager structure changes');
	}
	
	Free()
	{
	}
	
	async WaitForStructureChange()
	{
		return this.StructureChangeQueue.WaitForLatest();
	}
	
	async LoadStructure(Structure,DataSourceName=`Unknown`)
	{
		//	setup new layers
		async function AllocAndLoadLayerStructure(LayerStructure)
		{
			const Type = LayerStructure.Type;
			const Uniforms = LayerStructure.Uniforms;
			const Layer = this.LayerFactory(Type);
			await Layer.SetUniforms(Uniforms);
			return Layer;
		}
		const NewLayers = [];
		for ( let StructureLayer of Structure.Layers )
		{
			const NewLayer = await AllocAndLoadLayerStructure.call(this,StructureLayer);
			NewLayers.push( NewLayer );
		}
		
		//	if that succeeded, delete the old ones and load these
		this.Layers.forEach( Layer => Layer.Free() );
		this.Layers = NewLayers;
		this.StructureChangeQueue.Push(`Loaded Layers from ${DataSourceName}`);
	}
	
	async GetStructure()
	{
		function EncodeLayerToStructure(Layer)
		{
			const ForSerialisation = true;
			const LayerStructure = {};
			LayerStructure.Type = Layer.FactoryTypeName;
			LayerStructure.Uniforms = Layer.GetUniforms(ForSerialisation);
			return LayerStructure;
		}
		
		const Structure = {};
		Structure.Layers = this.Layers.map( EncodeLayerToStructure.bind(this) );
		return Structure;
	}
	
	GetLayerIndex(LayerName)
	{
		for ( let l=0;	l<this.Layers.length;	l++ )
			if ( this.GetLayerName(l) == LayerName )
				return l;
		return false;
	}
	
	GetLayerName(LayerIndex)
	{
		return `Layer${LayerIndex}`;
	}
	
	GetLayer(LayerIndex)
	{
		return this.Layers[LayerIndex];
	}
	
	InsertLayer(Layer,Position=null)
	{
		if ( !(Layer instanceof Layer_t) )
			throw `Layer is not a layer`;
		if ( Position === null )
			Position = this.Layers.length;
			 
		this.Layers.splice( Position, 0, Layer );
		this.OnLayerChanged(Layer,`Added`);
	}
	
	//	dirty a layer (do we need ids for layers here?)
	OnLayerChanged(Layer,ChangeInfo=`Changed`)
	{
		//	mark all layers after Layer as needing re-rendering [for the last frame-time]
		this.StructureChangeQueue.Push(`Layer ${ChangeInfo}`);
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
