import {Layer} from './Layer.js'

export default class LayerMp4 extends Layer
{
	constructor()
	{
		super();
	}
	
	//	needs to be async?
	GetKeyframeTimes()
	{
		return null;
	}
	
	async GetImage(FrameTimeMs,RenderContext)
	{
		throw `todo: get frame ${TimeMs} in mp4`;
	}
}

