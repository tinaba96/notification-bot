function mainGetScore(sheetName, link, channelId) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) return;

  //入力列の設定(行を挿入して設定)
  sheet.insertRowBefore(4);
  var dateCell = sheet.getRange(4, 1);
  dateCell.setValue(
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm')
  );

  [desktopResult, mobileResult] =  getAverageScore(link) // average of 10 times

  //結果の貼り付け
  sheet
    .getRange(4, 2, desktopResult.length, desktopResult[0].length)
    .setValues(desktopResult);
  sheet
    .getRange(4, 8, mobileResult.length, mobileResult[0].length)
    .setValues(mobileResult);

  // if the difference from yesterday is more than 0.10, notification will be sent to slack
  var difference = 10
  deteriorationCheck(sheet, link, desktopResult[0], mobileResult[0], difference, channelId)
  
}

//取得データの変換
function convertResult(content) {
  //２次元配列として設定
  var arr = [[]];
  //lighthouseScore
  arr[0].push(content.lighthouseResult.categories.accessibility.score);
  arr[0].push(content.lighthouseResult.categories['best-practices'].score);
  arr[0].push(content.lighthouseResult.categories.performance.score);
  arr[0].push(content.lighthouseResult.categories.pwa.score);
  arr[0].push(content.lighthouseResult.categories.seo.score);
  //cruxMetrics
  // arr[0].push(
  //   content.loadingExperience.metrics.overall_category
  // );
  // arr[0].push(content.loadingExperience.metrics.overall_category);
  // //lighthouseMetrics
  // arr[0].push(
  //   content.lighthouseResult.audits['first-contentful-paint'].percentile
  // );
  // arr[0].push(content.lighthouseResult.audits['speed-index'].displayValue);
  // arr[0].push(content.lighthouseResult.audits['interactive'].displayValue);
  // arr[0].push(
  //   content.lighthouseResult.audits['first-meaningful-paint'].displayValue
  // );
  // arr[0].push(content.lighthouseResult.audits['first-cpu-idle'].displayValue);
  // arr[0].push(
  //   content.lighthouseResult.audits['estimated-input-latency'].displayValue
  // );

  return arr;
}

//APIクエリーの作成
function setUpQuery(link, desktopFlg) {
  var api = PropertiesService.getScriptProperties().getProperty("LIGHTHOUSEAPI");
  var parameters = {
    url: encodeURIComponent(link),
    key: PropertiesService.getScriptProperties().getProperty("LIGHTHOUSEKEY")
  };
  var category = [
    'accessibility',
    'best-practices',
    'performance',
    'pwa',
    'seo'
  ];

  var query = api + '?';
  for (key in parameters) {
    query += '&' + key + '=' + parameters[key];
  }

  category.forEach(function(tmp) {
    query += '&category=' + tmp;
  });

  if (desktopFlg) {
    query += '&strategy=desktop';
  } else {
    query += '&strategy=mobile';
  }

  return query;
}

function getAverageScore(link) {
  var averageDataD = [0, 0, 0, 0, 0];
  var averageDataM = [0, 0, 0, 0, 0];
  var numberOfFailures = 0
  for(let i=0;i<10;i++){
    
    //デスクトップとモバイルの両方を計測
    var request = [setUpQuery(link, true), setUpQuery(link, false)];

    try {
      var response = [
        UrlFetchApp.fetch(request[0], { muteHttpExceptions: true }),
        UrlFetchApp.fetch(request[1], { muteHttpExceptions: true })
      ];
    } catch (err) {
      Logger.log(err);
      return err;
    }

    // jsonをパースする
    var parsedResult = [
      JSON.parse(response[0].getContentText()),
      JSON.parse(response[1].getContentText())
    ];

    console.log(i+1+'/10  measuring.....')
    
    if (parsedResult[0].error || parsedResult[1].error) {
      numberOfFailures += 1
      continue
    }

    var desktopResult = convertResult(parsedResult[0]);
    var mobileResult = convertResult(parsedResult[1]);


    for(let i=0;i<5;i++){
      averageDataD[i] += desktopResult[0][i]*100
      averageDataM[i] += mobileResult[0][i]*100
    }

    
  }

  console.log('10/10 measured.')
  

  if (10 - numberOfFailures == 0) {
    console.log('10 Failures')
    return []
  }
  
  for(let i=0;i<5;i++){
    averageDataD[i] /= (10 - numberOfFailures)
    averageDataD[i] = Math.round(averageDataD[i]*10)/10
    averageDataM[i] /= (10 - numberOfFailures)
    averageDataM[i] = Math.round(averageDataM[i]*10)/10
  }


  return [[averageDataD], [averageDataM]]

}

function postSlackbot(msg, channelId) {
  //set the token of the slack bot which is registered by SlackAPI
  let token = PropertiesService.getScriptProperties().getProperty("TOKEN");
  //define the Slackapp from the Library using the token
  let slackApp = SlackApp.create(token);

  try {
    //Post the message using postMessage method of the SlackApp Object
    let options = {
      // icon_url: PropertiesService.getScriptProperties().getProperty("ICON_URL"),
      username: 'Lighthouse Bot'
    };
    slackApp.postMessage(channelId, msg, options);
  } catch (e) {
    console.log(e);
    return false;
  }
  return true;
}


function deteriorationCheck(sheet, link, desktopResult, mobileResult, difference, channelId)
{
  var sendToSlack = false
  if (sheet.getRange('B5').getValue() == '') {console.log('no value'); return}
  if (Math.abs(sheet.getRange('B5').getValue()-desktopResult[0]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('C5').getValue()-desktopResult[1]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('D5').getValue()-desktopResult[2]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('E5').getValue()-desktopResult[3]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('F5').getValue()-desktopResult[4]) > difference) {sendToSlack = true}

  if (Math.abs(sheet.getRange('H5').getValue()-mobileResult[0]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('I5').getValue()-mobileResult[1]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('J5').getValue()-mobileResult[2]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('K5').getValue()-mobileResult[3]) > difference) {sendToSlack = true}
  if (Math.abs(sheet.getRange('L5').getValue()-mobileResult[4]) > difference) {sendToSlack = true}

  //will post to the channel every month
  const today = new Date();
  const date = today.getDate();
  if (date==1){ sendToSlack = true}

  if (sendToSlack) {
    
    // slackへ
    msg = `Lighthouse Score Notification \n
    URL: ${link} 

    // Lighthouse Score Sheet : 

    Desktop \n
    Accessibility: ${desktopResult[0]}
    Best-practice: ${desktopResult[1]}
    performance: ${desktopResult[2]}
    pwa: ${desktopResult[3]}
    seo: ${desktopResult[4]}


    Mobile \n
    Accessibility: ${mobileResult[0]}
    Best-practice: ${mobileResult[1]}
    performance: ${mobileResult[2]}
    pwa: ${mobileResult[3]}
    seo: ${mobileResult[4]}`;

    // LighthouseScoreSheet : 

    // defines the channel where the Slackbot posts the message
    if (postSlackbot(msg, channelId)) {
      console.log('Posted to The Channel.')
    } else {
      console.log('Could not post to the channel.');         
    }
  }
}
