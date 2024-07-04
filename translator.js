import PT from './pt.json' assert {type: 'json'};
import fs from 'fs';
import axios from 'axios'
import dotenv from 'dotenv';

dotenv.config();


//PREENCHER COM A LINGUA DESEJADA
const desiredLanguage = '';

if(desiredLanguage !== ''){

    function transformJson(inputJson) {
        const outputArray = [];
    
        for (const key in inputJson) {
        if (inputJson.hasOwnProperty(key)) {
            outputArray.push({ text: inputJson[key] });
        }
        }
    
        return outputArray;
    }

    function mergeData(originalJson, apiResults){
        let mergedData = {};
        let index = 0;

        for(const key in originalJson){
            const apiText = apiResults[index].translations[0].text;
            mergedData[key] = String(apiText);
            index++;
        }
        return mergedData;
    }

    const newJson = transformJson(PT);

    const params = {
        'api-version': '3.0',
        'to': desiredLanguage
    };

    async function requestTranslation() {
        const url = 'https://api.cognitive.microsofttranslator.com/translate';
        const apiKey = process.env.API_KEY;
        const region = process.env.API_REGION;


        try{
            const response = await axios.post(url, newJson, {
                params: params,
                headers: {
                    'Content-Type' : 'application/json',
                    'Ocp-Apim-Subscription-Key' : apiKey,
                    'Ocp-Apim-Subscription-Region' : region,
                }
            });


            const result = response.data;

            const translation = mergeData(PT, result)

            const formattedTranslation = JSON.stringify(translation, null, 2)

            fs.writeFileSync(`${desiredLanguage}.json`, formattedTranslation, 'utf8');
        } catch (error) {
            console.log("ERRO: ",error)
        }
    }

        requestTranslation();

} else {
    console.log("PREENCHA A LINGUAGEM DESEJADA")
}
