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
    recordAction: {
      checkFreeDiskSpace: {
        info: 'Disk space monitor is active, check desk space now ...',
        freeSpace: (number, limit) => `Free space is ${number} left (limit: ${limit})`,
        stopRecord: 'Space is not enough, stop record progress ...',
        StartRecord: 'Space is enough, start record progress ...'
      },
      livingChannel: {
        checkStatus: 'Check if any of users is offline...',
        isNoLivingChannel: 'No target user streaming',
        userIsStillStreaming: msg => `${msg} is still streaming`,
        userClosesStreaming: msg => `${msg} is offline, start to delete recording`,
        isTargetExist: 'Check if target user exist in living channels ...',

      }
    },
    upDate: {
      usersData: 'Users data userData.json updated',
      seedData: 'Seed data seedData.json updated',
      isStreaming: 'Stream record isStreaming.json updated'
    }
  },
  init: {
    folder: {
      recorder: {
        isNotExist: 'Directory recorder is not exist',
        startToCreateDirectory: 'Start to create recorder directory'
      },
      model: {
        isNotExist: 'Directory model is not exist',
        startToCreateDirectory: 'Start to create model directory'
      },
      seed: {
        isNotExist: 'Directory seed is not exist',
        startToCreateDirectory: 'Start to create seed directory'
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
      }
    },
    initiationIsFinished: 'Initiation finished'
  },
  seed: {
    initiation: 'Start input seed data to usersData...',
    initiationIsFinished: 'Seeding progress finished',
    numOfUsers: msg => `${msg} users are saved in usersData.json`
  }
}