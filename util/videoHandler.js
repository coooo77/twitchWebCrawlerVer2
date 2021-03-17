const fs = require('fs')
const path = require('path');
const cp = require('child_process');

// const { helper, modelHandler } = require('./helper')
const { processSetting } = require('../config/config')
const { app } = require('../config/announce')
// const { processAction } = app
// const { isNotExist, startToCreateFolder } = processAction.folder

const {
  suffix,
  fileLocation
} = processSetting

const {
  processed,
  origin,
  processing,
  defaultPath
} = fileLocation

const ffmpeg = require('./ffmpeg')

const videoHandler = {
  /**
   * 處理影片的主程序
   * @param {object} targetFileData 實況者影片處理設定、檔案資訊
   * @param {string} targetID 實況者ID
   */
  mainProgram(targetFileData, targetID) {
    const {
      taskMaker,
      moveFiles,
      fileCombiner,
      getProcessPath,
      processFinished,
      screenShotHandler,
      reductiveProcessChain
    } = videoHandler

    const { fileNames, processOption } = targetFileData
    const { keepOriginalFile, screenshots, combine } = processOption
    const task = taskMaker(fileNames, processOption)

    // 把所有檔案移動到processing
    const originalFilePath = origin
    const toPath = getProcessPath(defaultPath.processing)
    moveFiles(fileNames, originalFilePath, toPath)

    // 開始處理檔案
    // 需要確認到底每個promise傳出來的是什麼
    // 單一檔案等同於不要合併，但是能拍照
    reductiveProcessChain(task)
      .then((processedFileNames) => fileCombiner(processedFileNames, targetID, !keepOriginalFile, combine))
      .then((processedFileName) => screenShotHandler(processedFileName, screenshots))
      .then((processedFileName) => processFinished(processedFileName, targetID))
      .catch((error) => console.error(error))
  },

  getProcessPath(type) {
    switch (type) {
      case 'origin':
        return origin
      case 'processing':
        return processing || videoHandler.getDirPath(defaultPath.processing)
      case 'processed':
        return processed || videoHandler.getDirPath(defaultPath.processed)
      default:
        throw new Error('Invalid process type!')
    }
  },

  /**
   * 合併影片檔案，如果只有一個影片就不合併，跳下一個步驟
   * @param {string[]} processedFileNames 處理完的影片清單
   * @param {string} targetID 實況者ID
   * @param {boolean} isDeleteFile 是否刪除檔案
   * @returns {string[]} Promise 依照處理改名的檔名，不含路徑
   */
  fileCombiner(processedFileNames, targetID, isDeleteFile, isCombine) {
    console.log('fileCombiner')
    return new Promise((resolve, reject) => {
      if (!isCombine || processedFileNames.length === 1) {
        console.log('fileCombiner single file Or No combine')
        videoHandler.moveFilesToProcessed(processedFileNames)
        resolve(processedFileNames)
      } else {
        console.log('fileCombiner multi file')
        const filePath = videoHandler.getProcessPath(defaultPath.processing)
        const combineListPath = videoHandler.listMaker(filePath, processedFileNames, targetID)
        const processedFileName = videoHandler.getProcessFileName(processedFileNames[0], false, false, true)
        const combineCmd = `ffmpeg -f concat -safe 0 -i ${combineListPath} -c copy ${filePath}\\${processedFileName}`
        cp.exec(combineCmd, (err, stdout, stderr) => {
          fs.unlinkSync(combineListPath)
          if (!err) {
            console.log('File Combined！！！！！')
            console.log('CombineFile:', `${filePath}\\${processedFileName}`, 'isExist', fs.existsSync(`${filePath}\\${processedFileName}`))
            console.log('isDeleteFile', isDeleteFile)
            if (isDeleteFile) {
              for (const fileNames of processedFileNames) {
                console.log('DELETE FILE:', `${filePath}\\${fileNames}`)
                fs.unlinkSync(`${filePath}\\${fileNames}`)
              }
            } else {
              videoHandler.moveFilesToProcessed(processedFileNames)
            }
            videoHandler.moveFilesToProcessed([processedFileName])
            resolve([processedFileName])
          } else {
            reject(err)
          }
        })
      }
    })
  },

  listMaker(dirLocation, fileNames, targetID) {
    //開始製作合併需要的list
    let fileCmd = ''
    for (const fileName of fileNames) {
      fileCmd += `file '${dirLocation}\\${fileName}'` + '\n'
    }
    const txtNameWithPath = `${dirLocation}\\${targetID}${Date.now()}.txt`
    fs.writeFileSync(txtNameWithPath, fileCmd)
    return txtNameWithPath
  },

  screenShotHandler(processedFileName, screenshotRatios) {
    console.log('screenshotRatios', screenshotRatios, processedFileName)
    // TODO 測試都不拍照是否成功
    if (processedFileName.length === 1) {
      console.log('Start picture')
      return screenshotRatios.reduce((chain, currentRatio, currentIndex) => {
        return chain.then(() => videoHandler.screenShot(processedFileName[0], currentRatio, currentIndex + 1))
      }, Promise.resolve())
    } else {
      console.log('no picture')
      Promise.resolve(processedFileName)
    }
  },

  screenShot(processedFileName, screenshotRatio, index) {
    console.log('screenShot screenshotRatio:', screenshotRatio)
    return new Promise((resolve, reject) => {
      const root = videoHandler.getProcessPath(defaultPath.processed)
      const processedFileNameWithPath = path.resolve(`${root}\\${processedFileName}`)
      videoHandler.getDuration(processedFileNameWithPath)
        .then((duration) => {
          if (duration) {
            console.log('processedFileNameWithPath', processedFileNameWithPath)
            const cmd = `ffmpeg -ss ${duration * screenshotRatio} -i ${processedFileNameWithPath} -y -vframes 1 ${processedFileNameWithPath}-${index}.jpg`
            cp.exec(cmd, (err, stdout, stderr) => {
              console.log('err\n', err)
              // console.log('stdout\n', stdout)
              console.log('stderr\n', stderr)

              if (!err) {
                resolve([processedFileName])
              } else {
                reject(err)
              }
            })
          } else {
            console.log('Loss Duration, skip shot')
            resolve(processedFileName)
          }
        })
    })
  },

  getDuration(filePath) {
    console.log('filePath', filePath)
    return new Promise(resolve => {
      ffmpeg()
        .input(filePath)
        .ffprobe((err, data) => {
          console.log('file', filePath, 'isExist', fs.existsSync(filePath))
          const duration = data && data.streams[0].duration
          console.log('duration', duration)
          resolve(duration)
        })
    })
  },

  processFinished(processedFileName, targetID) {
    console.log('processFinished', processedFileName, targetID)
    return new Promise(async (resolve) => {
      // 把所有檔案移動到processed
      videoHandler.moveFilesToProcessed([processedFileName])

      // 更新processor
      const processorFile = await videoHandler.getJSObjData('./model/processor.json')
      if (targetID in processorFile.onGoing) {
        const finishedData = processorFile.onGoing[targetID]
        processorFile.success.push(finishedData)
        delete processorFile.onGoing[targetID]
      }
      console.log('[]]更新processor:', processorFile)
      await videoHandler.saveJSObjData(processorFile, 'processor')
      resolve()
    })
  },

  /**
   * 將指定的檔案移動到指定的位置
   * @param {string[]} fileNames 檔案名稱
   * @param {string} from 檔案位置
   * @param {string} to 目標移動位置
   */
  moveFiles(fileNames, from, to) {
    for (const fileName of fileNames) {
      const fromPath = `${from}\\${fileName}`
      if (fs.existsSync(fromPath)) {
        const toPath = `${to}\\${fileName}`
        fs.renameSync(fromPath, toPath)
      } else {
        console.log("Can not find", fromPath)
      }
    }
  },

  /**
   * 把檔案移動到完成的資料夾processed
   * @param {string[]} files 
   */
  moveFilesToProcessed(files) {
    // 移動檔案到processed
    console.log('移動檔案到processed')
    const from = videoHandler.getProcessPath(defaultPath.processing)
    const to = videoHandler.getProcessPath(defaultPath.processed)
    videoHandler.moveFiles(files, from, to)
  },

  taskMaker(fileNames, processOption) {
    const task = []
    for (const fileName of fileNames) {
      task.push({
        fileName,
        processOption,
        filePath: videoHandler.getProcessPath(defaultPath.processing)
      })
    }
    return task
  },

  /**
   * 依序執行組裝好的錄製資料
   * @param {{
   *  fileName:string
   *  filePath:string
   *  processOption:object
   * }} files 組裝好的錄製資料
   * @returns {string[]} Promise 依照處理改名的檔名，不含路徑
   */
  reductiveProcessChain(files) {
    return files.reduce((chain, currentData) => {
      return chain.then((log) => videoHandler.processVideo(currentData, log))
    }, Promise.resolve())
  },

  processVideo(videoDetail, processedFileNames = []) {
    console.log('processVideo', videoDetail)

    return new Promise((resolve, reject) => {

      const { fileName, filePath, processOption } = videoDetail
      const { mute, compress, keepOriginalFile } = processOption
      const processFileName = videoHandler.getProcessFileName(fileName, mute, compress)

      if (!mute && !compress) {
        processedFileNames.push(processFileName)
        resolve(processedFileNames)
      } else {
        const fileSource = `${filePath}\\${fileName}`
        const cmd = videoHandler.getFFMPEGCmd(fileSource, processFileName, mute, compress)
        console.log('processVideo cp.exec', cmd)
        cp.exec(cmd, (err, stdout, stderr) => {
          if (!err) {
            console.log('process done!!!!!!!!!!!', fileName, fileSource)
            if (!keepOriginalFile) {
              videoHandler.deleteFile(fileName, fileSource)
            } else {
              videoHandler.moveFilesToProcessed([fileName])
            }
            processedFileNames.push(processFileName)
            resolve(processedFileNames)
          } else {
            reject(err)
          }
        })
      }
    })

  },

  deleteFile(fileName, fileSource) {
    try {
      fs.unlinkSync(fileSource)
    } catch (error) {
      const errorMsg = `Can not delete file ${fileName}`
      // helper.announcer(errorMsg, 'warn')
      throw new Error(errorMsg)
    }
  },

  getFFMPEGCmd(fileSource, processFileName, mute, compress) {
    let cmd = `ffmpeg -i ${fileSource}`
    const path = videoHandler.getProcessPath(defaultPath.processing)
    if (compress) {
      cmd += ` -vcodec libx264 -crf 28 -preset ultrafast ${mute ? '-an' : ''} -y "${path}\\${processFileName}"`
    } else if (mute) {
      cmd += ` -c copy -an -y "${path}\\${processFileName}"`
    }
    return cmd
  },

  getProcessFileName(fileName, isMute, isCompress, isCombined = false) {
    const dotIndex = fileName.lastIndexOf('.')
    const fileType = fileName.slice(dotIndex)
    let sliceName = fileName.slice(0, dotIndex)
    if (isMute) sliceName += `${suffix.mute ? `_${suffix.mute}` : '_mute'}`
    if (isCompress) sliceName += `${suffix.compress ? `_${suffix.compress}` : '_compress'}`
    if (isCombined) sliceName += `${suffix.combined ? `_${suffix.combined}` : '_combined'}`
    return `${sliceName}${fileType}`
  },

  makeDirIfNotExist(folderName, folderRootPath) {
    const filePath = path.resolve(folderRootPath, folderName)
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath)
    }
    return filePath
  },

  getDirPath(folderName) {
    const root = videoHandler.getRootFolderPath()
    const process = videoHandler.makeDirIfNotExist('Process', root)
    const targetPath = videoHandler.makeDirIfNotExist(folderName, process)
    return targetPath
  },

  /**
   * 取得根目錄路徑
   * @returns {string} 根目錄路徑
   */
  getRootFolderPath() {
    const dirPath = __dirname
    const spliceIndex = dirPath.lastIndexOf('\\')
    return dirPath.slice(0, spliceIndex)
  },

  saveJSObjData(data, fileName = 'usersData', dirLocation = './model/') {
    return new Promise((resolve, reject) => {
      try {
        fs.writeFileSync(
          `${dirLocation}${fileName}.json`,
          JSON.stringify(data),
          'utf8',
          (error) => {
            console.log(error);
          })
        resolve()
      } catch (error) {
        console.error(error)
        reject(error)
      }
    })
  },

  async getJSObjData(dataLocation) {
    let result = await fs.readFileSync(dataLocation, 'utf8', (err, data) => data)
    result = JSON.parse(result)
    return result
  }

}

module.exports = videoHandler