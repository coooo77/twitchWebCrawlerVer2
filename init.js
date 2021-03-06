(async () => {
  const { helper, modelHandler } = require('./util/helper')
  const { announcer } = helper
  const { makeDirIfNotExist, makeJsonIfNotExist } = modelHandler
  const { init } = require('./config/announce')
  const { folder, jsonFile, initiationIsFinished } = init
  const { recorder, model, seed } = folder
  const { isStreaming, usersData, seedData, vodRecord, processor } = jsonFile

  const settings = {
    folder: [
      {
        description: '建立recorder資料夾',
        location: './recorder',
        info: recorder
      },
      {
        description: '建立model資料夾',
        location: './model',
        info: model
      },
      {
        description: '建立model/seed資料夾',
        location: './model/seed',
        info: seed
      }
    ],
    json: [
      {
        description: '建立isStreaming.json',
        dataLocation: './model/isStreaming.json',
        info: isStreaming,
        defaultData: { records: [], ids: [] },
        fileName: 'isStreaming',
        fileLocation: './model/'
      },
      {
        description: '建立usersData.json',
        dataLocation: './model/usersData.json',
        info: usersData,
        defaultData: { records: [], ids: [] },
        fileName: 'usersData',
        fileLocation: './model/'
      },
      {
        description: '建立vodRecord.json',
        dataLocation: './model/vodRecord.json',
        info: vodRecord,
        defaultData: {
          "pending": {},
          "ready": [],
          "onGoing": [],
          "success": [],
          "error": [],
          "queue": []
        },
        fileName: 'vodRecord',
        fileLocation: './model/'
      },
      {
        description: '建立processor.json',
        dataLocation: './model/processor.json',
        info: processor,
        defaultData: {
          "pending": {},
          "onGoing": {},
          "success": [],
          "error": [],
          "queue": {}
        },
        fileName: 'processor',
        fileLocation: './model/'
      },
      {
        description: '建立seedData.json',
        dataLocation: './model/seed/seedData.json',
        info: seedData,
        defaultData: [{ twitchID: 'fill Twitch User Id You Want To Follow' }],
        fileName: 'seedData',
        fileLocation: './model/seed/'
      }
    ]
  }

  settings.folder.forEach(setting => {
    const { info, location } = setting
    makeDirIfNotExist(info, location)
  })

  settings.json.forEach(async (setting) => {
    await makeJsonIfNotExist(setting)
  })

  announcer(initiationIsFinished)
})()
