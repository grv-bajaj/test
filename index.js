const { transformZohoData } = require('./src/transformers/buyer');
const { sendToNetcore } = require('./src/services/netcoreService');
const { saveToRawS3, saveToProcessedS3 } = require('./src/services/s3Service');

exports.handler = async (event) => {
    console.log('Processing SQS event with', event.Records?.length || 0, 'records');
    for (const record of event.Records || []) {
        const messageId = record.messageId;
        try {
            const messageBody = JSON.parse(record.body);
            console.log(`Processing message ${messageId}:`, messageBody);

            // Step 1: Save raw data to S3
            await saveToRawS3(messageId, messageBody);
            console.log(`✅ Raw data saved for ${messageId}`);

            // Step 2: Transform data
            const transformedData = transformZohoData(messageBody);
            console.log(`✅ Data transformed for ${messageId}`);
            console.log(transformedData);

            // Step 3: Send to Netcore
            try {
                const netcoreResponse = await sendToNetcore(transformedData);
                console.log('✅ Netcore response:', netcoreResponse);
            } catch (err) {
                console.error('❌ Netcore send failed for', messageId, err?.response?.data || err.message || err);
                // if you want duplicates to never cause retry, above code won't be reached for duplicate case
                throw err; // this will cause SQS retry for real errors
            }
              
            // Step 4: Save processed data to S3
            await saveToProcessedS3(messageId, transformedData);
            console.log(`✅ Processed (transfromed) data saved for ${messageId} in S3.`);

        } catch (error) {
            console.error(`❌ Failed processing ${messageId}:`, error.message);
            throw error;
        }
    }
    return { statusCode: 200 };
};