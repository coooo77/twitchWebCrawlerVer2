const { recordSetting } = require('./config')
const { prefix, maxTryTimes } = recordSetting
module.exports = {
  app: {
    startToLogin: 'User needs to login, start to login...',
    startToFetchStream: 'Start to fetch stream ...',
    manualLogin: 'Manual function is active, enter your account and password please',
    askAccount: 'Enter your account : ',
    askPassword: 'Enter your password : ',
    askSMS: 'Enter SMS number : ',
    askSMSAgain: 'SMS input action fail, enter your SMS again : ',
    noDataInfo: 'Account or password missed, please fill it!',
    noOnlineInfo: 'Can not fetch any of online streamer data, errors may occurred.',
    noUserInfo: user => `Can not find User ${user}, start to create data`,
    userRecordDisabled: (user, config) => `User ${user} config: ${config} is active, stopping to record stream. Set it to false if you want to record it.`,
    recordAction: {
      checkFreeDiskSpace: {
        info: 'Disk space monitor is active, check desk space now ...',
        freeSpace: (number, limit) => `Free space is ${number} left (limit: ${limit})`,
        stopRecord: 'Space is not enough, stop record progress ...',
        StartRecord: 'Space is enough, start record progress ...'
      },
      livingChannel: {
        checkStatus: '=> Check if any of users is offline...',
        isNoLivingChannel: 'No target user streaming',
        userIsStillStreaming: msg => `${msg} is still streaming`,
        inValidOffline: (user, retryTimes) => `${user} record type is stream, status is updated by recording cmd. Retry ${retryTimes} times (max: ${maxTryTimes * 10} times) to delete file from isStreaming.json.`,
        userCloseStream: user => `${user} is offline, start to delete isStreaming Data`,
        isTargetExist: 'Check if target user exist in living channels ...',
        isInRetryInterval: (user, retryTimes) => `${user} is offline, retry ${retryTimes} times (max: ${maxTryTimes} times) to delete file from isStreaming.json.`
      },
      record: {
        start: '=> Start to check and record stream...',
        stop: (user, reason = 'type') => `Stop to record user ${user}, ${reason === 'type' ? `type of stream content isn't target type` : `stream is still in retry interval`}`,
        stopVOD: user => `User ${user} VOD type isn't target type`,
        findOnlineUser: user => `User ${user} is streaming, start to Record`,
        end: user => `User ${user}'s stream is closed, start to delete recording`,
        reachLimit: (user, url) => `User ${user}'s VOD has reached download limit, url is ${url}.`,
        vodDownloadDetailLoss: (user, url) => `User ${user}'s VOD download information lost! Url is ${url}.`
      },
      VOD: {
        start: '=> start to get VOD information...'
      }
    },
    upDate: {
      usersData: 'Users data userData.json updated',
      seedData: 'Seed data seedData.json updated',
      isStreaming: 'Stream record isStreaming.json updated',
      vodRecord: 'VOD recorder vodRecord.json updated',
      processor: 'File handling record processor.json updated',
      debugLog: 'Debug Log debugLog.json updated'
    },
    batchFile: {
      isExist: twitchID => `File ${twitchID}.bat exists`,
      isNotExist: twitchID => `File ${twitchID}.bat does not exist`,
      created: msg => `Create ${prefix}${msg}.bat`,
      processKilled: msg => `${msg}'s record process killed`
    },
    processAction: {
      isStopped: millisecond => `File process procedure is occupied, delay ${Math.floor(millisecond / (60 * 1000))} minutes`,
      isStart: user => `Start to handle ${user}'s record`,
      pendingFileMissed: user => `${user}'s pending record is missed`,
      folder: {
        isNotExist: dirName => `Folder ${dirName} is not exist`,
        startToCreateFolder: path => `Start to create recorder folder, path: ${path}`
      }
    }
  },
  init: {
    folder: {
      recorder: {
        isNotExist: 'Directory recorder is not exist',
        startToCreateFolder: 'Start to create recorder directory'
      },
      model: {
        isNotExist: 'Directory model is not exist',
        startToCreateFolder: 'Start to create model directory'
      },
      seed: {
        isNotExist: 'Directory seed is not exist',
        startToCreateFolder: 'Start to create seed directory'
      }
    },
    jsonFile: {
      isStreaming: {
        isNotExist: 'isStreaming.json is not exist',
        startToCreate: 'Start to create isStreaming.json'
      },
      usersData: {
        isNotExist: 'UsersData.json is not exist',
        startToCreate: 'Start to create usersData.json'
      },
      seedData: {
        isNotExist: 'seedData.json is not exist',
        startToCreate: 'Start to create seedData.json'
      },
      vodRecord: {
        isNotExist: 'vodRecord.json is not exist',
        startToCreate: 'Start to create vodRecord.json'
      },
      processor: {
        isNotExist: 'processor.json is not exist',
        startToCreate: 'Start to create processor.json'
      }
    },
    initiationIsFinished: 'Initiation finished'
  },
  seed: {
    initiation: 'Start input seed data to usersData...',
    initiationIsFinished: 'Seeding progress finished',
    numOfUsers: msg => `${msg} users are saved in usersData.json`
  },
  twitch: {
    startToMonitor: 'Start to monitor Twitch web site ...',
    timeAnnounce: msg => `第${msg}次執行檢查，輸入ctrl+c結束錄影 ${new Date().toLocaleString()}`,
    errorOccurred: `Error Occur!!! -${new Date().toLocaleString()}-`
  },
  sorter: {
    arrayLength: (name, number) => `${name} length: ${number}`,
    elementLoss: (user, arrayComparedName) => `Can not find ${user} in ${arrayComparedName}`
  }
}