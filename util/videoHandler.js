const fs = require('fs')
const path = require('path');
const cp = require('child_process');

const { processSetting } = require('../config/config')
const { app } = require('../config/announce')

const {
  suffix,
  fileLocation,
  enableShowCmd,
  processOutputType,
  allowMultiFileTakeScreenShot
} = processSetting

const {
  processed,
  origin,
  processing,
  defaultPath
} = fileLocation

const ffmpeg = require('./ffmpeg')

const isShowCmd = enableShowCmd ? 'start ' : ''

const videoHandler = {
  /**
   * 處理影片的主程序
   * @param {object} targetFileData 實況者影片處理設定、檔案資訊
   * @param {string} targetID 實況者ID
   */
  mainProgram(targetFileData, targetID) {
    try {
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
        .catch((error) => videoHandler.upDateOngoingFiles(targetID, 'error', { error: error.message }))
    } catch (error) {
      videoHandler.upDateOngoingFiles(targetID, 'error', { error })
    }
  },

  /**
   * 取得原始檔案、處理中或已經完成的檔案位置
   * @param {string} type "origin" | "processing" |　"processed"
   * @returns {string}　path 檔案位置
   */
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
    return new Promise((resolve, reject) => {
      try {
        if (!isCombine || processedFileNames.length === 1) {
          videoHandler.moveFilesToProcessed(processedFileNames)
          resolve(processedFileNames)
        } else {
          const filePath = videoHandler.getProcessPath(defaultPath.processing)
          const combineListPath = videoHandler.listMaker(filePath, processedFileNames, targetID)
          const processedFileName = videoHandler.getProcessFileName(processedFileNames[0], false, false, true, processOutputType)
          const combineCmd = `ffmpeg -f concat -safe 0 -i ${combineListPath} -c copy ${filePath}\\${processedFileName}`
          cp.exec(isShowCmd + combineCmd, (error, stdout, stderr) => {
            fs.unlinkSync(combineListPath)
            if (!error) {
              if (isDeleteFile) {
                for (const fileNames of processedFileNames) {
                  fs.unlinkSync(`${filePath}\\${fileNames}`)
                }
              } else {
                videoHandler.moveFilesToProcessed(processedFileNames)
              }
              videoHandler.moveFilesToProcessed([processedFileName])
              resolve([processedFileName])
            } else {
              reject({ ProcedureName: 'fileCombiner ffmpeg', error })
            }
          })
        }
      } catch (error) {
        reject({ ProcedureName: 'fileCombiner', error: error.message })
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

  /**
   * 串接拍照Promise
   * @param {string[]} processedFileName 已經處理過的純檔案名稱，沒有檔案位置
   * @param {number[]} screenshotRatios 拍照的位置
   * @returns {Promise} 回傳processedFileName
   */
  screenShotHandler(processedFileName, screenshotRatios) {
    if (!allowMultiFileTakeScreenShot) {
      // 不允許複數檔案拍照
      if (processedFileName.length === 1) {
        return screenshotRatios.reduce((chain, currentRatio, currentIndex) => {
          return chain.then(() => videoHandler.screenShot(processedFileName[0], currentRatio, currentIndex + 1))
        }, Promise.resolve())
      } else {
        Promise.resolve(processedFileName)
      }
    } else {
      // 允許複數檔案拍照
      const reduceChainArray = processedFileName.map(fileName => screenshotRatios.reduce((chain, currentRatio, currentIndex) => {
        return chain.then(() => videoHandler.screenShot(fileName, currentRatio, currentIndex + 1, processedFileName))
      }, Promise.resolve()))

      return reduceChainArray.reduce((chain, currentPromise) => chain.then(() => currentPromise), Promise.resolve())
    }
  },

  /**
   * 拍照Promise
   * @param {string} processedFileName 當前處理的檔案名稱
   * @param {number} screenshotRatio 拍照時間點
   * @param {number} index 檔名index
   * @param {string[]} AllFileNames 所有要處理的檔案名稱，同screenShotHandler的processedFileName參數
   * @returns {Promise | Error} 回傳AllFileNames或錯誤
   */
  screenShot(processedFileName, screenshotRatio, index, AllFileNames) {
    return new Promise((resolve, reject) => {
      try {
        const root = videoHandler.getProcessPath(defaultPath.processed)
        const processedFileNameWithPath = path.resolve(`${root}\\${processedFileName}`)
        videoHandler.getDuration(processedFileNameWithPath)
          .then((duration) => {
            if (duration) {
              const cmd = `ffmpeg -ss ${duration * screenshotRatio} -i ${processedFileNameWithPath} -y -vframes 1 ${processedFileNameWithPath}-${index}.jpg`
              cp.exec(cmd, (error, stdout, stderr) => {
                if (!error) {
                  resolve(AllFileNames)
                } else {
                  reject({ ProcedureName: 'screenShot ffmpeg', error })
                }
              })
            } else {
              console.log('Loss Duration, skip shot')
              resolve(AllFileNames)
            }
          })
      } catch (error) {
        reject({ ProcedureName: 'screenShot', error: error.message })
      }
    })
  },

  getDuration(filePath) {
    return new Promise((resolve, reject) => {
      try {
        ffmpeg()
          .input(filePath)
          .ffprobe((error, data) => {
            const duration = data && data.streams[0].duration
            resolve(duration)
          })
      } catch (error) {
        reject({ ProcedureName: 'getDuration', error: error.message })
      }
    })
  },

  /**
   * 把onGoing的資料動到 success | error
   * @param {string} targetID 實況者ID
   * @param {string} type 移動的目標位置 success | error
   * @param {object} addData 補充的資料，例如錯誤訊息等等
   */
  async upDateOngoingFiles(targetID, type = 'success', addData = null) {
    const processorFile = await videoHandler.getJSObjData('./model/processor.json')
    if (targetID in processorFile.onGoing) {
      let finishedData = processorFile.onGoing[targetID]
      finishedData.finishedTime = new Date().toLocaleString()
      if (addData) {
        finishedData = { ...finishedData, ...addData }
      }
      processorFile[type].push(finishedData)

      delete processorFile.onGoing[targetID]
    }
    await videoHandler.saveJSObjData(processorFile, 'processor')
  },

  /**
   * 檔案處理結束，移動檔案到結束、更新檔案從onGoing到success
   * @param {string} processedFileName 已經處理完畢的檔案名稱
   * @param {string} targetID 實況者ID
   * @returns undefined
   */
  processFinished(processedFileName, targetID) {
    return new Promise(async (resolve) => {
      // 把所有檔案移動到processed
      videoHandler.moveFilesToProcessed([processedFileName])
      // 更新processor
      videoHandler.upDateOngoingFiles(targetID)
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
    return new Promise((resolve, reject) => {
      try {
        const { fileName, filePath, processOption } = videoDetail
        const { mute, compress, keepOriginalFile } = processOption
        const processFileName = videoHandler.getProcessFileName(fileName, mute, compress, false, processOutputType)

        if (!mute && !compress) {
          processedFileNames.push(processFileName)
          resolve(processedFileNames)
        } else {
          const fileSource = `${filePath}\\${fileName}`
          const fileProcessedSource = `${filePath}\\${processFileName}`
          const cmd = videoHandler.getFFMPEGCmd(fileSource, processFileName, mute, compress)
          cp.exec(isShowCmd + cmd, (error, stdout, stderr) => {
            if (!error) {
              try {
                if (!keepOriginalFile) {
                  if (!fs.existsSync(fileProcessedSource)) {
                    throw new Error('Processed file missed, can not delete original file.')
                  } else {
                    videoHandler.deleteFile(fileName, fileSource)
                  }
                } else {
                  videoHandler.moveFilesToProcessed([fileName])
                }
                processedFileNames.push(processFileName)
                resolve(processedFileNames)
              } catch (error) {
                reject({ ProcedureName: 'processVideo ffmpeg', error: error.message })
              }
            } else {
              reject({ ProcedureName: 'processVideo ffmpeg', error })
            }
          })
        }
      } catch (error) {
        reject({ ProcedureName: 'processVideo', error: error.message })
      }
    })
  },

  deleteFile(fileName, fileSource) {
    try {
      fs.unlinkSync(fileSource)
    } catch (error) {
      console.error(`Can not delete file ${fileName}`)
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

  /**
   * 根據設定修改檔案名稱
   * @param {string} fileName 檔案名稱(something.ts/something.mp4)
   * @param {boolean} isMute 是否靜音
   * @param {boolean} isCompress  是否壓縮
   * @param {boolean} isCombined 是否合併(非必要參數)
   * @param {string} fileTypeName 指定輸出類型 ts | mp4(非必要參數)
   * @returns {string} 檔案名稱something_mute_compress_combined.mp4
   */
  getProcessFileName(fileName, isMute, isCompress, isCombined = false, fileTypeName = null) {
    const dotIndex = fileName.lastIndexOf('.')
    const fileType = fileTypeName || fileName.slice(dotIndex)
    let sliceName = fileName.slice(0, dotIndex)
    if (isMute) sliceName += `${suffix.mute ? `_${suffix.mute}` : '_mute'}`
    if (isCompress) sliceName += `${suffix.compress ? `_${suffix.compress}` : '_compress'}`
    if (isCombined) sliceName += `${suffix.combined ? `_${suffix.combined}` : '_combined'}`
    return `${sliceName}${fileType}`
  },

  /**
   * 建立資料夾
   * @param {string} folderName 資料夾名稱
   * @param {string} folderRootPath 資料夾位置(不包含資料夾名稱)
   * @returns {string} 資料夾位置
   */
  makeDirIfNotExist(folderName, folderRootPath) {
    const filePath = path.resolve(folderRootPath, folderName)
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(filePath)
    }
    return filePath
  },

  /**
   * 取得對應資料夾位置，沒有的話就會用預設設定創造資料夾
   * @param {string} folderName 資料夾名稱
   * @returns {string} 資料夾位置 
   */
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

  /**
   * 
   * @param {object}} data 
   * @param {string} fileName 想要存的json檔案名稱
   * @param {string} dirLocation 檔案位置(不包含檔案名稱)
   * @returns {promises.reject} 拋錯處裡
   */
  saveJSObjData(data, fileName = 'usersData', dirLocation = './model/') {
    return new Promise((resolve, reject) => {
      try {
        fs.writeFileSync(
          `${dirLocation}${fileName}.json`,
          JSON.stringify(data),
          'utf8',
          (error) => {
            console.error(error);
            reject({ ProcedureName: 'saveJSObjData', error })
          })
        resolve()
      } catch (error) {
        console.error(error)
        reject({ ProcedureName: 'saveJSObjData', error: error.message })
      }
    })
  },

  /**
   * 取得json資料
   * @param {string} dataLocation json檔案絕對位置(包含檔名)
   * @returns {object} 解析過的檔案
   */
  async getJSObjData(dataLocation) {
    let result = await fs.readFileSync(dataLocation, 'utf8', (error, data) => {
      if (error) {
        throw new Error({ ProcedureName: 'getJSObjData', error })
      }
      return data
    })
    result = JSON.parse(result)
    return result
  }

}

module.exports = videoHandler