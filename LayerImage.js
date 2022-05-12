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
	
	GetUniforms(ForSerialisation=false)
	{
		const Uniforms = {};
		
		//	may need something to indicate if we're serialising
		//	as we dont want to convert to base64 each time...
		if ( ForSerialisation )
		{
			/*
			Uniforms.ImageWidth = this.Image.GetWidth();
			Uniforms.ImageHeight = this.Image.GetHeight();
			Uniforms.ImagePixelFormat = this.Image.GetPixelFormat();
			const PixelBuffer = this.Image.GetPixelBuffer();
			
			Uniforms.ImageBase64 = this.Image.Pixels;
			*/
			Uniforms.ImagePng = this.Image.GetDataUrl();
		}
		
		return Uniforms;
	}
	
	async SetUniforms(Uniforms)
	{
		//	load png
		if ( Uniforms.ImagePng )
		{
			await this.Image.LoadPng(Uniforms.ImagePng);
		}
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

