const readline = require('readline');
const twitchStreams = require('twitch-get-stream')
const { loginSetting, recordSetting, seedUsersDataSetting, checkDiskSpaceAction } = require('../config/config')
const { locationOfDiskWhereRecordSaved, locationOfFolderWhereRecordSaved, reTryInterval, maxTryTimes, prefix, stopRecordDuringReTryInterval, isRecordEveryOnlineChannel } = recordSetting
const { login, homePage } = require('../config/domSelector')
const { app, sorter } = require('../config/announce')
const checkDiskSpace = require('check-disk-space')
const cp = require('child_process')
const fs = require('fs');

const helper = {
  wait(ms) {
    return new Promise(resolve => setTimeout(() => resolve(), ms))
  },
  announcer(message, type = 'system') {
    if (type === 'system') {
      console.log(`[SYSTEM] ${message}`)
    } else if (type === 'warn') {
      console.log(`\n[WARNING] ${message}` + '\n')
    } else if (type === 'time') {
      console.log(`\n[ LOG ] ${message}`)
    } else if (type === 'mode') {
      console.log(`[MODE] ${message}`)
    }
  },
  manualInput(msg) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise(resolve => {
      rl.question(msg, answer => {
        rl.close()
        resolve(answer)
      })
    })
  },
  async clickAndInput(page, selector, inputContent) {
    await page.click(selector)
    await page.keyboard.type(inputContent)
  },
  async clickAndNavigate(page, selector, waitTime,) {
    await helper.wait(waitTime)
    const target = await page.$(selector)
    if (target) {
      result = await Promise.all([
        page.click(selector),
        page.waitForNavigation()
      ])
    }
  },
  async getAccountAndPassword() {
    if (loginSetting.isManual) {
      helper.announcer(app.manualLogin, 'mode')
      account = await helper.manualInput(app.askAccount)
      password = await helper.manualInput(app.askPassword)
    } else {
      account = process.env.TWITCH_ACCOUNT
      password = process.env.TWITCH_PASSWORD
    }
    if (!account || !password) {
      helper.announcer(app.noDataInfo, 'warn')
      return
    }
    return { account, password }
  },
  async login(page, account, password) {
    await page.waitForSelector(login.confirmBtn, { visible: true })
    await helper.clickAndInput(page, login.inputUserName, account)
    await helper.clickAndInput(page, login.inputPassword, password)
    await page.click(login.confirmBtn)
  },
  async verifySMS(page) {
    await page.click(login.recordFor30Days)
    const SMS = await helper.manualInput(app.askSMS)
    await helper.clickAndInput(page, login.inputSMS, SMS)
    await page.click(login.confirmSMSBtn)
  },
  async scrollDownUntilCanNot(page) {
    // let count = 0
    let height = await helper.measureHeight(page)
    const viewportHeight = page.viewport().height
    let viewportIncr = 0

    while (viewportIncr + viewportHeight < height) {
      const params = { viewportHeight, selector: homePage.scrollBody }
      await page.evaluate(_params => {
        const target = document.querySelector(_params.selector)
        target.scrollBy(0, _params.viewportHeight)
      }, params)
      await helper.wait(20)
      height = await helper.measureHeight(page)
      viewportIncr = viewportIncr + viewportHeight
      // await page.screenshot({ path: `${++count}.png` })
    }
  },
  async measureHeight(page) {
    const mainBody = await page.$(homePage.mainBody)
    const { height } = await mainBody.boxModel()
    await mainBody.dispose()
    return height
  },
  async getOnlineStreamsData(page) {
    const streamers = await page.evaluate(selector => {
      const data = Array.from(document.querySelectorAll(selector))
      return data.map(node => {
        const html = node.innerHTML
        const handleHtml = html.split(' ')
        const href = handleHtml.filter(str => str.includes('href='))
        const twitchID = href[1].split('/')[1]
        const gameTypeHref = href[2].split('"')[1]
        const streamTypes = gameTypeHref.split('/')[3]
        return ({ twitchID, streamTypes })
      })
    }, homePage.liveCannelCard)
    return streamers
  },
  async checkDiskSpace() {
    const { free, size } = await checkDiskSpace(locationOfDiskWhereRecordSaved)
    const { type, below } = checkDiskSpaceAction.judgeBy
    const { unit, digit, number } = below
    let spaceLeft, info, limit
    switch (unit) {
      case 'percentage':
        spaceLeft = (free / size) * 100
        info = `${spaceLeft.toFixed(digit)} %`
        limit = `${number} %`
        break;
      case 'MB':
        spaceLeft = (free / type.MB)
        info = `${spaceLeft.toFixed(digit)} MB`
        limit = `${number} MB`
        break;
      case 'GB':
        spaceLeft = (free / type.GB)
        info = `${spaceLeft.toFixed(digit)} GB`
        limit = `${number} GB`
        break;
      case 'TB':
        spaceLeft = (free / type.TB)
        info = `${spaceLeft.toFixed(digit)} TB`
        limit = `${number} TB`
        break;
      default:
    }
    helper.announcer(app.recordAction.checkFreeDiskSpace.freeSpace(info, limit))
    return spaceLeft > number
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
        helper.announcer(app.upDate[`${fileName}`])
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
  },
  makeDirIfNotExist(info, location) {
    if (!fs.existsSync(location)) {
      helper.announcer(info.isNotExist)
      helper.announcer(info.startToCreateDirectory)
      fs.mkdirSync(location)
    }
  },
  async makeJsonIfNotExist(setting) {
    const { dataLocation, info, defaultData, fileName, fileLocation } = setting
    if (!fs.existsSync(dataLocation)) {
      helper.announcer(info.isNotExist)
      helper.announcer(info.startToCreate)
      await helper.saveJSObjData(defaultData, fileName, fileLocation)
    }
  },
  async removeRecord(data, twitchID) {
    recordsIndex = data.records.findIndex(record => record.twitchID === twitchID)
    const recordTime = data.records[recordsIndex].createdTime
    const timePassed = Date.now() - recordTime
    const limit = reTryInterval * 1000 * maxTryTimes
    const isInRetryInterval = (timePassed) < (limit)
    if (!isInRetryInterval) {
      idsIndex = data.ids.findIndex(id => id === twitchID)
      data.ids.splice(idsIndex, 1)
      data.records.splice(recordsIndex, 1)
      await helper.saveJSObjData(data, 'isStreaming')
    } else {
      helper.announcer(app.recordAction.record.isKept(twitchID, timePassed / 60000, limit / 60000))
    }
  },
  async upDateIsRecording(data, userId, status) {
    const userIndex = data.records.findIndex(user => user.twitchID === userId)
    data.records[userIndex].isRecording = status
    await helper.saveJSObjData(data, 'usersData')
  },
  async checkChannelStatus(twitchID) {
    let result
    try {
      await twitchStreams.get(twitchID)
    } catch (error) {
      result = error.response.status
    } finally {
      return result !== 404
    }
  },
  async checkLivingChannel(onlineStreamsData, isStreaming, usersData) {
    const { livingChannel } = app.recordAction
    helper.announcer(livingChannel.checkStatus)
    const livingChannelList = onlineStreamsData.map(channel => channel.twitchID)
    if (isStreaming.ids.length !== 0) {
      for (let i = isStreaming.ids.length - 1; i >= 0; i--) {
        const targetID = isStreaming.ids[i]
        if (livingChannelList.includes(targetID)) {
          helper.announcer(livingChannel.userIsStillStreaming(targetID))
        } else {
          const isChannelOnline = await helper.checkChannelStatus(targetID)
          if (isChannelOnline) {
            helper.announcer(livingChannel.userIsStillStreaming(targetID))
          } else {
            helper.announcer(livingChannel.userClosesStreaming(targetID))
            helper.removeRecord(isStreaming, targetID)
            helper.upDateIsRecording(usersData, targetID, false)
          }
        }
      }
    } else {
      helper.announcer(livingChannel.isNoLivingChannel)
    }
  },
  async startToRecordStream(onlineStreamsData, isStreaming, usersData, dirName) {
    helper.announcer(app.recordAction.record.start)
    for (let i = 0; i < onlineStreamsData.length; i++) {
      const { twitchID, streamTypes } = onlineStreamsData[i]

      let user = usersData.records.find(user => user.twitchID === twitchID)

      if (isRecordEveryOnlineChannel) {
        if (!user) {
          helper.announcer(app.noUserInfo(twitchID))
          user = helper.addUserToUsersData(usersData, twitchID)
        }
        if (!user.isRecording) helper.checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming, dirName)
      } else if (user && !user.isRecording) {
        helper.checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming, dirName)
      }
    }
  },
  addUserToUsersData(usersData, twitchID) {
    const user = {
      id: usersData.records.length,
      twitchID,
      ...seedUsersDataSetting
    }
    helper.upDateJsonFile(usersData, user, 'usersData')
    return user
  },
  checkStreamTypeAndRecord(user, streamTypes, twitchID, usersData, isStreaming, dirName) {
    const recordingUser = isStreaming.records.find(user => user.twitchID === twitchID)
    const isInRetryInterval = recordingUser ? (Date.now() - recordingUser.createdTime) < (reTryInterval * maxTryTimes * 1000) : false
    const { checkStreamContentType } = user
    const { isActive, targetType } = checkStreamContentType
    if (isActive && !targetType.includes(streamTypes)) {
      helper.announcer(app.recordAction.record.stop(twitchID, 'type'))
    } else if (stopRecordDuringReTryInterval && recordingUser && isInRetryInterval) {
      helper.announcer(app.recordAction.record.stop(twitchID, 'interval'))
    } else if (!recordingUser) {
      helper.recordStream(user, usersData, isStreaming, dirName)
    }
  },
  recordStream(user, usersData, isStreaming, dirName) {
    helper.announcer(app.recordAction.record.findOnlineUser(user.twitchID))
    helper.upDateIsRecording(usersData, user.twitchID, true)
    helper.upDateJsonFile(isStreaming, user)
    helper.record(user.twitchID, dirName)
  },
  async upDateJsonFile(jsonFile, userData, file = 'isStreaming') {
    let record
    if (file === 'isStreaming') {
      record = {
        ...userData,
        createdTime: Date.now(),
        createdLocalTime: new Date().toLocaleString()
      }
    } else if (file === 'usersData') {
      record = userData
    }
    jsonFile.records.push(record)
    jsonFile.ids.push(userData.twitchID)
    await helper.saveJSObjData(jsonFile, file)
  },
  record(twitchID, dirName) {
    try {
      fs.accessSync(`./recorder/${prefix}${twitchID}.bat`, fs.constants.F_OK)
      helper.announcer(app.batchFile.isExist(twitchID))
    } catch (error) {
      helper.announcer(app.batchFile.isNotExist(twitchID))
      helper.announcer(app.batchFile.created(twitchID))
      fs.writeFileSync(`./recorder/${prefix}${twitchID}.bat`, helper.commandMaker(twitchID), (error) => {
        console.log(error);
      })
    } finally {
      helper.execFile(`${prefix}${twitchID}`, dirName)
    }
  },
  commandMaker(twitchID) {
    return `
    @echo off\n
    set name=${twitchID}\n
    set url=https://www.twitch.tv/%name%\n
    set count=0\n
    :loop\n
    set hour=%time:~0,2%\n
    if "%hour:~0,1%" == " " set hour=0%hour:~1,1%\n
    set /a count+=1\n
    echo [CountDown] Loop for ${maxTryTimes} times, try %count% times ... \n
    streamlink --twitch-disable-hosting %url% best -o ${locationOfFolderWhereRecordSaved}\\${prefix}%name%_twitch_%DATE%_%hour%%time:~3,2%%time:~6,2%.mp4\n
    if "%count%" == "${maxTryTimes}" exit\n
    echo [CountDown] count down for ${reTryInterval} sec...\n
    @ping 127.0.0.1 -n ${reTryInterval} -w 1000 > nul\n
    goto loop
    `
  },
  execFile(fileName, dirName) {
    const commands = cp.exec('start ' + dirName + `\\recorder\\${fileName}.bat`, (error, stdout, stderr) => {
      if (error) {
        console.log(`Name: ${error.name}\nMessage: ${error.message}\nStack: ${error.stack}`)
      }
    })
    // process.on('exit', function () {
    //   helper.announcer(app.batchFile.processKilled(fileName))
    //   commands.kill()
    // })
  },
  arrayComparer(array, arrayCompared, arrayName, arrayComparedName) {
    helper.announcer(sorter.arrayLength(arrayName, array.length))
    for (element of array) {
      if (!arrayCompared.includes(element)) {
        helper.announcer(sorter.elementLoss(element, arrayComparedName))
      }
    }
  }
}

module.exports = helper