// please put this function to getAllScore.gs
  
function example() {
  // create a sheet for storing the result data (ex. example_sheet)
  var sheetName = 'NameOfSheet'

  // put the target link where you want to measure the lighthouse score
  var link = 'https://www.sample.jp/';

  // put slack channel where you want to receive the notofication
  var slackChannelId = 'NameOfChannel' // ex) #notify_slackbot

  // execute main function
  mainGetScore(sheetName, link, slackChannelId)
}
