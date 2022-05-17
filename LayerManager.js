import Layer_t from './Layer.js'
import Pop from './PopEngine/PopEngine.js'
import Layer_Frag from './LayerFrag.js'
import Layer_DepthEstimate from './LayerDepthEstimate.js'
import Layer_Image from './LayerImage.js'
import {CreateColourTexture} from './PopEngine/Images.js'
import PromiseQueue from './PopEngine/PromiseQueue.js'
import {UnsupportedLayerType} from './Layer.js'

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

		//	return an unsupported layer type if unsupported so we retain layer
		if ( !TypeMatch )
			return new UnsupportedLayerType(TypeName);

		//	return an unsupported layer type if we fail to construct a known type
		try
		{
			const NewLayer = new TypeMatch();
			return NewLayer;
		}
		catch(e)
		{
			console.warn(`Failed to create layer ${TypeName}; ${e}`);
			return new UnsupportedLayerType(TypeName,e);
		}
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
	
	async Render(FrameTimeMs,LayerNames,GetLayer,OnLayerProducedImage)
	{
		//	render each layer
		let Uniforms = {};
		Uniforms.PreviousLayerImage = this.NullTexture;
		
		//	initialise output in case we dont reach the end
		if ( OnLayerProducedImage )
		{
			for ( let LayerName of LayerNames )
				OnLayerProducedImage( LayerName, null );
		}
		
		for ( let LayerName of LayerNames )
		{
			const Layer = GetLayer(LayerName);
			let LayerOutput;
			try
			{
				const ReadBackPixels = OnLayerProducedImage != null;
				LayerOutput = await Layer.GetImage( FrameTimeMs, Uniforms, this.RenderContext, ReadBackPixels );
			}
			catch(e)
			{
				console.warn(`Error rendering layer ${LayerName}; ${e}`);
				
				//	slow down for things like compile errors
				await Pop.Yield(2*1000);
				break;
			}
			
			//	maybe this should be layer->promise?
			if ( OnLayerProducedImage )
				OnLayerProducedImage( LayerName, LayerOutput );
			
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
		
		this.Layers = {};
		this.StructureChangeQueue = new PromiseQueue('LayerManager structure changes');
	}
	
	Free()
	{
	}
	
	async WaitForStructureChange()
	{
		return this.StructureChangeQueue.WaitForLatest();
	}
		
	async SetSerialisedData(DataJson)
	{
		const Data = JSON.parse(DataJson);
		this.SetStructure( Data.Structure );
		
		for ( let LayerName in Data.LayerUniforms )
		{
			const LayerUniforms = Data.LayerUniforms[LayerName];
			const Layer = this.Layers[LayerName];
			await Layer.SetUniforms(LayerUniforms);
		}
	}
	
	async GetSerialisedData()
	{
		const Data = {};
		Data.Structure = await this.GetStructure();
		Data.LayerUniforms = {};
		for ( let LayerName in this.Layers )
		{
			const ForSerialisation = true;
			const Layer = this.Layers[LayerName];
			const Uniforms = Layer.GetUniforms(ForSerialisation);
			Data.LayerUniforms[LayerName] = Uniforms;
		}
		return JSON.stringify( Data, null, '\t' );
	}
	
	SetStructure(Structure,DataSource=`Unknown`)
	{
		//	create/reorder layers
		const NewLayers = {};
		
		for ( let LayerName in Structure.Layers )
		{
			const LayerStructure = Structure.Layers[LayerName];
			let Layer = this.Layers[LayerName];
			if ( !Layer )
				Layer = this.LayerFactory( LayerStructure.Type );
			NewLayers[LayerName] = Layer;
		}
		
		//	overwrite old layers (will delete/reorder)
		this.Layers = NewLayers;
		this.StructureChangeQueue.Push(`SetStructure from ${DataSource}`);
	}
	
	GetStructure()
	{
		function GetLayerStructure(Layer)
		{
			const LayerStructure = {};
			LayerStructure.Type = Layer.FactoryTypeName;
			return LayerStructure;
		}
		
		const Structure = {};
		Structure.Layers = {};
		for ( let LayerName in this.Layers )
		{
			const Layer = this.Layers[LayerName];
			const LayerStruct = GetLayerStructure(Layer);
			Structure.Layers[LayerName] = LayerStruct;
		}
		return Structure;
	}
	
	GetLayerIndex(LayerName)
	{
		const LayerNames = Object.keys(this.Layers);
		return LayerNames.indexOf(LayerName);
	}
	
	GetLayerName(LayerIndex)
	{
		const LayerNames = Object.keys(this.Layers);
		return LayerNames[LayerIndex];
	}
	
	GetLayer(LayerName)
	{
		if ( typeof LayerName == typeof 123 )
			throw `GetLayer(${LayerName}) with number instead of name`;
		return this.Layers[LayerName];
	}
	
	GetNewLayerName()
	{
		let Name = `New Layer`;
		for ( let SuffixNumber=1;	SuffixNumber<100;	SuffixNumber++ )
		{
			const NewLayerName = Name + ( SuffixNumber == 1 ? '' : SuffixNumber );
			if ( !this.GetLayer(NewLayerName) )
				return NewLayerName;
		}
		throw `Failed to generate a unique layer name`;
	}
	
	InsertLayer(LayerName,Layer,Position=null)
	{
		if ( LayerName === null )
			LayerName = this.GetNewLayerName();
			
		if ( this.GetLayer(LayerName) )
			throw `Layer ${LayerName} already exists`;
			
		let LayerType;
		if ( Layer instanceof Layer_t )
		{
			LayerType = Layer.FactoryTypeName;
		}
		else
		{
			LayerType = Layer;
			Layer = null;
		}

		if ( Position === null )
			Position = Object.keys(this.Layers).length;
	
		const NewLayerMeta = {};
		NewLayerMeta.Type = LayerType;
		
		//	get & set structure
		const Structure = this.GetStructure();
		
		//	set instance of layer so it's fetched when we load the structre
		if ( Layer )
			this.Layers[LayerName] = Layer;
		
		//	set position by getting a list & regenerating
		let LayerEntries = Object.entries(Structure.Layers);
		const NewLayerEntry = [LayerName,NewLayerMeta];
		LayerEntries.splice( Position, 0, NewLayerEntry );
		Structure.Layers = Object.fromEntries( new Map(LayerEntries) );
		
		this.SetStructure( Structure, `Added ${LayerType}` );
	}
	
	//	dirty a layer (do we need ids for layers here?)
	OnLayerChanged(Layer,ChangeInfo=`Changed`)
	{
		//	mark all layers after Layer as needing re-rendering [for the last frame-time]
		this.StructureChangeQueue.Push(`Layer ${ChangeInfo}`);
	}
	
	async Render(FrameTimeMs,OnLayerProducedImage)
	{
		const LayerNames = Object.keys(this.Layers);
		const GetLayer = this.GetLayer.bind(this);
		await this.Renderer.Render( FrameTimeMs, LayerNames, GetLayer, OnLayerProducedImage );
	}
}
