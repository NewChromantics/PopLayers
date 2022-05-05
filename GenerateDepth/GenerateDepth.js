import {CreatePromise} from '../PopEngine/PromiseQueue.js'

//<script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/tasks@0.0.1-alpha.8"></script>
//<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js"></script>
//<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js"></script>


const TensorflowLiteScriptUrl = `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite/dist/tf-tflite.min.js`;
const TensorflowScriptUrl = `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.0.0/dist/tf.min.js`;
const MidasModelFilename = `lite-model_midas_v2_1_small_1_lite_1.tflite`;

//	insert <script> tag to load js
let TensorflowLiteScript;
let TensorflowScript;

//	midas model as arraybuffer
let MidasModelData;
let MidasModelPromise;

//	generic function
async function LoadJsModuleScript(ModuleUrl)
{
	const HeadElement = document.getElementsByTagName('head')[0];
	let ModuleScriptElement = document.createElement('script');
	ModuleScriptElement.type = 'text/javascript';
	
	const LoadedPromise = CreatePromise();
	ModuleScriptElement.onload = LoadedPromise.Resolve;
	ModuleScriptElement.onerror = LoadedPromise.Reject;
	ModuleScriptElement.src = ModuleUrl;
	HeadElement.appendChild(ModuleScriptElement);

	//	wait for script to load
	await LoadedPromise;

	//	todo: test() callback to verify script's content
	//if ( !window.DracoDecoderModule )
	//	throw `Script didn't create global DracoDecoderModule var`;
	return ModuleScriptElement
}


async function GetTensorFlowModule()
{
	if ( !TensorflowScript )
	{
		TensorflowScript = await LoadJsModuleScript(TensorflowScriptUrl);
	}
	if ( !TensorflowLiteScript )
	{
		TensorflowLiteScript = await LoadJsModuleScript(TensorflowLiteScriptUrl);
	}
	return window.tflite;
}


async function FetchMidasModelData(Url)
{
	//	todo: big file, so get progress callback
	const Response = await fetch(Url);
	if ( !Response.ok )
		throw `${Response.statusCode}`;
	
	const Data = await Response.arrayBuffer();
	return Data;
}

async function FetchAndCreateMidasModel()
{
	const Tflite = await GetTensorFlowModule();

	const Backend = 'webgl';
	//const Backend = 'wasm';

	window.tf.setBackend(Backend);
	
	let Url = import.meta.url;
	Url = Url.split('/').slice(0,-1).join('/');
	Url += `/${MidasModelFilename}`;
	MidasModelData = await FetchMidasModelData( Url );

	//	https://js.tensorflow.org/api_tflite/0.0.1-alpha.8/
	const Options = {};
	Options.backend = Backend;
	
	//	https://codelabs.developers.google.com/tensorflowjs-coral-tflite-node#5
	//let webnnDevice = WebNNDevice.GPU;
	//Options.delegates = [new WebNNDelegate({webnnDevice})];

	
	const tfliteModel = await Tflite.loadTFLiteModel(MidasModelData,Options);
	return tfliteModel
}

async function GetMidasModel()
{
	//	start download
	if ( !MidasModelPromise )
	{
		MidasModelPromise = FetchAndCreateMidasModel();
	}
	return MidasModelPromise;
}

export async function GenerateDepth(Image)
{
	const Model = await GetMidasModel();
	
	//	gr: convert image to tensor
	//	https://tfhub.dev/intel/midas/v2_1_small/1
	//	input: (uint8) RGB image with shape (3, 256, 256)
	//	output: (float32) inverse depth maps (1, 256, 256)
	//	but then example does reshape_img = img_input.reshape(1,3,256,256)
	let InputTensor = tf.browser.fromPixels(Image);
	const Width = 256;
	const Height = 256;
	const InputChannels = 3;
	InputTensor = InputTensor.reshape( [1,Width,Height,InputChannels] );

	//	slow bit, moved here so we're reminded we're doing it
	//	gr: it's not that slow. prediction is slow, but this removes the warning
	InputTensor = tf.cast( InputTensor, 'float32' );

	
	const Result = await Model.predict(InputTensor);
	
	//	todo: is output in... cm? metres?
	const ResultData = await Result.data();
	
	//	gr: are these some normalising range... or are they literally just min & max values?
	let Min = await Result.min().data();
	let Max = await Result.max().data();
	Min = Min[0];
	Max = Max[0];
	
	const Depth = {};
	Depth.MinValue = Min;
	Depth.MaxValue = Max;
	Depth.MinValue = 0;
	Depth.MaxValue = 1000;
	//	get these from output tensor
	Depth.Width = Width;
	Depth.Height = Height;
	Depth.PixelFormat = 'Float1';
	Depth.Pixels = ResultData;
	return Depth;
}
