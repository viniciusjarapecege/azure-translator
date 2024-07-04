import PT from './pt.json' assert { type: 'json' };
import fs from 'fs';
import readline from 'readline';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Function to transform the JSON structure
function transformJson(inputJson) {
    const outputArray = [];

    for (const key in inputJson) {
        if (inputJson.hasOwnProperty(key)) {
            outputArray.push({ text: inputJson[key] });
        }
    }

    return outputArray;
}

// Function to merge original JSON data with API results
function mergeData(originalJson, apiResults) {
    let mergedData = {};
    let index = 0;

    for (const key in originalJson) {
        const apiText = apiResults[index].translations[0].text;
        mergedData[key] = String(apiText);
        index++;
    }
    return mergedData;
}

// Function to request translation from the API
async function requestTranslation(desiredLanguage, newJson) {
    const url = 'https://api.cognitive.microsofttranslator.com/translate';
    const apiKey = process.env.API_KEY;
    const region = process.env.API_REGION;

    const params = {
        'api-version': '3.0',
        'to': desiredLanguage
    };

    try {
        const response = await axios.post(url, newJson, {
            params: params,
            headers: {
                'Content-Type': 'application/json',
                'Ocp-Apim-Subscription-Key': apiKey,
                'Ocp-Apim-Subscription-Region': region,
            }
        });

        const result = response.data;
        const translation = mergeData(PT, result);
        const formattedTranslation = JSON.stringify(translation, null, 2);

        fs.writeFileSync(`./languages/${desiredLanguage}.json`, formattedTranslation, 'utf8');
        console.log(`Translation file ${desiredLanguage}.json has been created successfully.`);
    } catch (error) {
        console.log("Error: ", error);
    }
}

// Read user input for the desired language
const reader = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

reader.question("Insira a linguagem desejada para gerar o arquivo traduzido de pt.json: ", function (answer) {
    const desiredLanguage = answer.trim();

    if (desiredLanguage !== '') {
        const newJson = transformJson(PT);
        requestTranslation(desiredLanguage, newJson);
    } else {
        console.log("PREENCHA A LINGUAGEM DESEJADA");
    }

    reader.close();
});
