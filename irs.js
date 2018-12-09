const fastCsv = require('fast-csv');
const fs = require('fs');
const jsdom = require('jsdom');
const request = require('requestretry');
const { JSDOM } = jsdom;

var outputStream = fs.createWriteStream('output.csv');
var outputCsvStream = fastCsv.createWriteStream({ headers: false });
outputStream.on('finish', () => {
    console.log('outputStream: done!');
});
outputCsvStream.pipe(outputStream);

/**
 * 
 * @param {string[]} csvRowArr 
 */
function extrapolate(csvRowArr) {
    var doneCounter = 0;

    function onDomProcessingDone() {
        doneCounter += 1;
        if (doneCounter == 7) {
            // 7 requests
            console.log(csvRowArr);
            outputCsvStream.write({
                a: csvRowArr[0],
                b: csvRowArr[1],
                c: csvRowArr[2],
                d: csvRowArr[3],
                e: csvRowArr[4],
                f: csvRowArr[5],
                g: csvRowArr[6],
                h: csvRowArr[7],
                i: csvRowArr[8]
            });
        }
        outputCsvStream.uncork();
        outputStream.uncork();
    }

    function getNumberOfOffices(body) {
        var irsDom = new JSDOM(body);
        var result;
        var irsDocument = irsDom.window.document;
        // extractedLine is something like "Records 1-1 of 1"
        var extractedLine = irsDocument.querySelector('#main > div.body > div.content > div > table:nth-child(5) > tbody > tr > td:nth-child(3) > font > b');
        if (extractedLine == null) {
            // console.log('hit null!');
            result = 0;
        } else {
            var splitExtractedLine = extractedLine.textContent.split(" ");
            result = splitExtractedLine[splitExtractedLine.length - 1];
        }
        if (isNaN(Number(result))) {
            console.error(body);
            throw 'result is not a number!';
        }
        return result;
    }

    function craftUrl(zipCode, radius) {
        return `https://apps.irs.gov/app/officeLocator/index.jsp?zipCode=${zipCode}&radius=${radius}&submit=1`;
    }

    function getFirstOfficeDistance(body) {
        var irsDom = new JSDOM(body);
        var result;
        var irsDocument = irsDom.window.document;
        // extractedLine is something like "Approximately 2 Miles"
        var extractedLine = irsDocument.querySelector('#main > div.body > div.content > div > table:nth-child(4) > tbody > tr:nth-child(8) > td:nth-child(2) > font');
        if (extractedLine == null || (!/Approximately\s+\d+\s+Miles/.test(extractedLine.textContent) && extractedLine.textContent != 'Same Town/City')) {
            extractedLine = irsDocument.querySelector('#main > div.body > div.content > div > table:nth-child(4) > tbody > tr:nth-child(5) > td:nth-child(2) > font');
        }
        if (extractedLine == null) {
            // console.log('hit null!');
            console.error(body);
            console.error(csvRowArr);
            throw 'Cannot find Office DOM!';
        } else {
            if (/Approximately\s+\d+\s+Miles/.test(extractedLine.textContent)) {
                var splitExtractedLine = extractedLine.textContent.split(" ");
                result = splitExtractedLine[1]; // hard-coding, but if it works it works
            } else if (extractedLine.textContent == 'Same Town/City') {
                result = -1;
            }

        }
        if (isNaN(Number(result))) {
            console.error(body);
            console.error(csvRowArr);
            console.error(result);
            if (extractedLine)
                console.error(extractedLine.textContent);
            throw 'result is not a number!';
        }
        return result;
    }

    //console.log(csvRowArr);
    var zipCode = csvRowArr[0];
    while (zipCode.length < 5) {
        zipCode = '0' + zipCode;
    }

    // 5
    request.get(craftUrl(zipCode, 5), (error, response, body) => {
        if (error) throw error;
        csvRowArr[2] = getNumberOfOffices(body).toString();
        onDomProcessingDone();
    });

    // 10
    request.get(craftUrl(zipCode, 10), (error, response, body) => {
        if (error) throw error;
        csvRowArr[3] = getNumberOfOffices(body).toString();
        onDomProcessingDone();
    });

    // 20
    request.get(craftUrl(zipCode, 20), (error, response, body) => {
        if (error) throw error;
        csvRowArr[4] = getNumberOfOffices(body).toString();
        onDomProcessingDone();
    });

    // 30
    request.get(craftUrl(zipCode, 30), (error, response, body) => {
        if (error) throw error;
        csvRowArr[5] = getNumberOfOffices(body).toString();
        onDomProcessingDone();
    });

    // 50
    request.get(craftUrl(zipCode, 50), (error, response, body) => {
        if (error) throw error;
        csvRowArr[6] = getNumberOfOffices(body).toString();
        onDomProcessingDone();
    });

    // 100
    request.get(craftUrl(zipCode, 100), (error, response, body) => {
        if (error) throw error;
        csvRowArr[7] = getNumberOfOffices(body).toString();
        onDomProcessingDone();
    });

    // 200
    request.get(craftUrl(zipCode, 200), (error, response, body) => {
        if (error) throw error;
        csvRowArr[8] = getNumberOfOffices(body).toString();
        if (csvRowArr[1] == '' || Number(csvRowArr[8]) < Number(csvRowArr[1])) {
            csvRowArr[1] = getFirstOfficeDistance(body).toString();
        }
        onDomProcessingDone();
    });
}

var stream = fs.createReadStream('firmuniquezip_5digit.csv');
var line = 0;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

var csvStream = fastCsv().on("data", async (data) => {
    line += 1;
    if (data[0] != '') {
        var oldLine = line;
        await sleep((line * 500)); // 7 requests per 3 seconds aye
        console.log('Extrapolating...', oldLine);
        // if (data[0] == '1773')
        // if (oldLine == 1825)
        extrapolate(data);
        // line += 1;
        
    } else {
        console.log('Unknown row:', data);
    }
}).on("end", () => {
    console.log('done!');
    console.log('line:', line);
});

/*
request.get('https://apps.irs.gov/app/officeLocator/index.jsp?zipCode=20005&radius=30&submit=1', (error, response, body) => {
    console.log('body', body);
});
*/
async function demo() {
    console.log('hello');
    await sleep(2000);
    console.log('there');
}
stream.pipe(csvStream);