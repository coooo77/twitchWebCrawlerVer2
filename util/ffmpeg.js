const path = require('path');

const { processSetting } = require('../config/config')

const {
  probePath,
  ffmpegPath,
} = processSetting

const ffmpeg = require('fluent-ffmpeg');

if (!probePath) {
  throw new Error('Can not find ffprobe, set it before starting app')
} else {
  ffmpeg.setFfprobePath(path.join(probePath));
}

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(path.join(ffmpegPath));
}

module.exports = ffmpeg