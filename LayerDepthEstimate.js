import Layer_t from './Layer.js'
import PopImage from './PopEngine/PopWebImageApi.js'
import {GenerateDepth} from './GenerateDepth/GenerateDepth.js'

export default class LayerDepthEstimate extends Layer_t
{
	constructor()
	{
		super();
	}

	async GetImage(FrameTimeMs,RenderUniforms,RenderContext,NeedCpuPixels)
	{
		const PreviousImage = RenderUniforms.PreviousLayerImage;
		if( !PreviousImage )
			throw `Depth estimate layer needs a previous layer`;
		
		const PreviousImageData = await PreviousImage.GetAsHtmlImageData();
		const DepthImage = await GenerateDepth( PreviousImageData );
		
		const DepthPopImage = new PopImage();
		DepthPopImage.WritePixels( DepthImage.Width, DepthImage.Height, DepthImage.Pixels, DepthImage.PixelFormat );

		return DepthPopImage;
	}
}

