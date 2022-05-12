import Layer_t from './Layer.js'
import PopImage from './PopEngine/PopWebImageApi.js'
import {CreateRandomImage} from './PopEngine/Images.js'


export default class LayerImage extends Layer_t
{
	constructor()
	{
		super();
		this.Image = CreateRandomImage( 10,10 );
	}
	
	async LoadFile(ImageData)
	{
		const Image = new PopImage();
		await Image.LoadPng( ImageData );
		this.Image = Image;
	}
	
	GetUniforms()
	{
		const Uniforms = {};
		
		//	may need something to indicate if we're serialising
		//	as we dont want to convert to base64 each time...
		Uniforms.Image = this.Image.Pixels;
		return Uniforms;
	}
	
	GetUniformMetas()
	{
		const Metas = {};
		Metas.Image = { Visible:false };
		return Metas;
	}
	
	async GetImage(FrameTimeMs,RenderUniforms,RenderContext,NeedCpuPixels)
	{
		if ( !this.Image )
			throw `Layer is missing image`;
		return this.Image;
	}
}

