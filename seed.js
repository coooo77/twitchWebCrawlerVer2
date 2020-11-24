(async () => {
  const { seedUsersDataSetting } = require('./config/config')
  const { seed } = require('./config/announce')
  const helper = require('./util/helper')

  helper.announcer(seed.initiation)

  const [seedData, usersData] = await Promise.all([
    helper.getJSObjData('./model/seed/seedData.json'),
    helper.getJSObjData('./model/usersData.json')
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

  await helper.saveJSObjData(usersData)
  helper.announcer(seed.numOfUsers(seedData.length))
  helper.announcer(seed.initiationIsFinished)
})()