const { url, checkDiskSpaceAction } = require('./config/config')
const { login } = require('./config/domSelector')
const { app } = require('./config/announce')
const { helper, webHandler, modelHandler, downloadHandler, fileHandler } = require('./util/helper')
require('dotenv').config()

module.exports = async (browser) => {
  const page = await browser.newPage();
  try {
    await page.goto(url.twitch, { waitUntil: 'domcontentloaded' });
    await helper.wait(2000)
    // 檢查是否需要登入
    const facebookBtn = await page.$(login.facebookBtn)
    // await page.screenshot({ path: 'facebookBtn.png' });
    if (facebookBtn) {
      helper.announcer(app.startToLogin)
      // 開始登入
      const { account, password } = await helper.getAccountAndPassword()
      await webHandler.login(page, account, password)
      await helper.wait(2000)
      //驗證SMS
      const confirmSMSBtn = await page.$(login.confirmSMSBtn)
      if (confirmSMSBtn) {
        await webHandler.verifySMS(page)
      }
      await webHandler.clickAndNavigate(page, login.confirmSMSBtn, 2000)
    }

    // 檢查硬碟空間
    if (checkDiskSpaceAction.isActive) {
      const checkFreeDiskSpace = app.recordAction.checkFreeDiskSpace
      helper.announcer(checkFreeDiskSpace.info)
      const isDiskSpaceEnough = await helper.checkDiskSpace()
      if (isDiskSpaceEnough) {
        helper.announcer(checkFreeDiskSpace.StartRecord)
      } else {
        helper.announcer(checkFreeDiskSpace.stopRecord)
        return
      }
    }

    // 開始錄影
    // await page.screenshot({ path: 'homePage.png' });
    let height = 0
    while (true) {
      await webHandler.scrollDownUntilCanNot(page)
      await helper.wait(1000)
      const currentHeight = await webHandler.measureHeight(page)
      if (height !== currentHeight) {
        height = currentHeight
      } else {
        break
      }
    }

    // 取得實況主英文ID與實況類型 & 取得VOD紀錄
    const [onlineStreamsData, vodRecord, processor] = await Promise.all([
      webHandler.getOnlineStreamsData(page),
      modelHandler.getJSObjData('./model/vodRecord.json'),
      modelHandler.getJSObjData('./model/processor.json'),
    ])

    if (onlineStreamsData.length !== 0) {
      // 檢查是否有實況主下線，是的話把isRecording改為false
      const [isStreaming, usersData] = await Promise.all([
        modelHandler.getJSObjData('./model/isStreaming.json'),
        modelHandler.getJSObjData('./model/usersData.json'),
      ])
      await helper.checkLivingChannel(onlineStreamsData, isStreaming, usersData, vodRecord)
      // 開始錄影
      await helper.startToRecord(onlineStreamsData, isStreaming, usersData, vodRecord, page)
    } else {
      helper.announcer(app.noOnlineInfo, 'warn')
    }

    // 下載指定時間下載的VOD
    if (vodRecord.queue.length !== 0) {
      // await?
      await downloadHandler.startToRecordVOD(vodRecord)
    }

    // 檔案處理
    const processorQueue = Object.keys(processor.queue)
    if (processorQueue.length !== 0) {
      await fileHandler.checkIsFileNeedToProcess(processor, processorQueue)
    }

  } catch (error) {
    console.error(error)
    await helper.debuglog('Error', error.message)
  } finally {
    await page.close();
    // await browser.close()
  }
}
