const fs = require('fs')

const config = {
  processOption: {
    "keepOriginalFile": false,
    "mute": true,
    "compress": true,
    "combine": false,
    "validProcessPeriod": {
      "from": {
        "hour": 0,
        "minute": 0
      },
      "to": {
        "hour": 23,
        "minute": 59
      }
    },
    "screenshots": [
      0.3,
      0.4,
      0.5,
      0.6,
      0.7,
      0.8,
      0.9
    ]
  },
  isAutoIntegrate: false,
  processorDataPath: `${__dirname}\\model\\processor.json`,
  filesSourcePath: `${__dirname}\\model`,
  filesDestinationPath: 'D:\\JD'
}

const files = fs.readdirSync(config.filesSourcePath)
const videos = files.filter(file => file.includes('.ts') || file.includes('.mp4'))

if (videos.length !== 0) {
  // 製作pending資料
  const filesSetting = videos.reduce((acc, filePath, index) => {
    const fileName = filePath.split('_')[0]
    return {
      ...acc,
      [`${index}_${fileName}`]: {
        fileNames: [filePath],
        processOption: config.processOption,
        createdLocalTime: new Date().toLocaleString()
      }
    }
  }, {})

  // 製作queue資料
  const objKeys = Object.keys(filesSetting)
  const fileHandleTimes = objKeys.reduce((acc, keys) => {
    return {
      ...acc,
      [keys]: new Date()
    }
  }, {})

  // 把檔案移動回去
  for (const fileName of videos) {
    const fromPath = `${config.filesSourcePath}\\${fileName}`
    if (fs.existsSync(fromPath)) {
      const toPath = `${config.filesDestinationPath}\\${fileName}`
      fs.renameSync(fromPath, toPath)
    } else {
      console.log("Can not find", fromPath)
    }
  }

  if (config.isAutoIntegrate) {
    const processorData = JSON.parse(fs.readFileSync(config.processorDataPath))
    if (processorData) {
      processorData.pending = { ...processorData.pending, ...filesSetting }
      processorData.queue = { ...processorData.queue, ...fileHandleTimes }
      fs.writeFileSync(
        config.processorDataPath,
        JSON.stringify(processorData),
        'utf8',
        (error) => {
          console.log(error);
        })
      console.log('DONE')
    } else {
      throw new Error('Can not find processor.json.')
    }
  } else {
    const jsonFile = {
      pending: filesSetting,
      queue: fileHandleTimes
    }
    fs.writeFileSync(
      `${config.filesSourcePath}\\${Date.now()}.json`,
      JSON.stringify(jsonFile),
      'utf8',
      (error) => {
        console.log(error);
      })
  }
} else {
  console.error('No files are available in', config.filesSourcePath)
}
