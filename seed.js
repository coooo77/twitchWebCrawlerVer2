(async () => {
  const { seedUsersDataSetting } = require('./config/config')
  const { seed } = require('./config/announce')
  const { helper, modelHandler } = require('./util/helper')

  helper.announcer(seed.initiation)

  const [seedData, usersData] = await Promise.all([
    modelHandler.getJSObjData('./model/seed/seedData.json'),
    modelHandler.getJSObjData('./model/usersData.json')
  ])


  let twitchIDList = seedData.map(user => user.twitchID)
  twitchIDList = Array.from(new Set(twitchIDList))
  twitchIDList = twitchIDList.sort()

  const records = twitchIDList.map((user, index) => ({
    id: index,
    twitchID: user,
    ...seedUsersDataSetting
  }))
  const ids = twitchIDList

  usersData.records = records
  usersData.ids = ids

  await modelHandler.saveJSObjData(usersData)
  helper.announcer(seed.numOfUsers(seedData.length))
  helper.announcer(seed.initiationIsFinished)
})()