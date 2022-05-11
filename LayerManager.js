import Layer_t from './Layer.js'
import Pop from './PopEngine/PopEngine.js'
import Layer_Frag from './LayerFrag.js'
import {CreateColourTexture} from './PopEngine/Images.js'
import PromiseQueue from './PopEngine/PromiseQueue.js'


const LayerTypes = [
Layer_Frag
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
		for ( let l=0;	l<LayerCount;	l++ )
		{
			const Layer = GetLayer(l);
			let LayerOutput;
			try
			{
				LayerOutput = await Layer.GetImage( FrameTimeMs, Uniforms, this.RenderContext );
			}
			catch(e)
			{
				console.warn(`Error rendering layer ${l}/${LayerCount}; ${e}`);
				break;
			}
			
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
			FinalRenderUniforms.PreviousLayerImage = Uniforms.PreviousLayerImage;
			const FinalRenderTarget = null;	//	screen
			const FinalRenderCommands = await this.BlitToScreenLayer.GetRenderCommands( FinalRenderUniforms, this.RenderContext, FinalRenderTarget );
			await this.RenderContext.Render( FinalRenderCommands );
		}
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
	
	async WaitForStructureChange()
	{
		return this.StructureChangeQueue.WaitForLatest();
	}
	
	async LoadStructure(Structure,DataSourceName=`Unknown`)
	{
		//	setup new layers
		function AllocAndLoadLayerStructure(LayerStructure,Index)
		{
			const Type = LayerStructure.Type;
			const Uniforms = LayerStructure.Uniforms;
			const Layer = this.LayerFactory(Type);
			Layer.SetUniforms(Uniforms);
			return Layer;
		}
		const NewLayers = Structure.Layers.map( AllocAndLoadLayerStructure.bind(this) );
		
		//	if that succeeded, delete the old ones and load these
		this.Layers.forEach( Layer => Layer.Free() );
		this.Layers = NewLayers;
		this.StructureChangeQueue.Push(`Loaded Layers from ${DataSourceName}`);
	}
	
	async GetStructure()
	{
		function EncodeLayerToStructure(Layer)
		{
			const LayerStructure = {};
			LayerStructure.Type = Layer.FactoryTypeName;
			LayerStructure.Uniforms = Layer.GetUniforms();
			return LayerStructure;
		}
		
		const Structure = {};
		Structure.Layers = this.Layers.map( EncodeLayerToStructure.bind(this) );
		return Structure;
	}
	
	GetLayer(LayerIndex)
	{
		return this.Layers[LayerIndex];
	}
	
	InsertLayer(Layer,Position)
	{
		if ( !(Layer instanceof Layer_t) )
			throw `Layer is not a layer`;
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
