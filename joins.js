exports.handler = async (event, context) => {
    console.log("=== LAMBDA FUNCTION CALLED ===");
    
    // Pretty print the entire event
    console.log("📦 FULL EVENT:");
    console.log(JSON.stringify(event, null, 4));
    
    console.log("\n" + "=".repeat(50));
    
    // Check if data is in body
    if (event.body) {
        console.log("📝 BODY CONTENT:");
        console.log("Raw Body:", event.body);
        
        if (typeof event.body === 'string') {
            try {
                const parsed = JSON.parse(event.body);
                console.log("🎯 PARSED BODY (Pretty):");
                console.log(JSON.stringify(parsed, null, 4));
            } catch (e) {
                console.log("❌ Body is not valid JSON");
            }
        }
    }
    
    // Check headers
    if (event.headers) {
        console.log("\n📋 HEADERS:");
        console.log(JSON.stringify(event.headers, null, 4));
    }
    
    // Check query params
    if (event.queryStringParameters) {
        console.log("\n🔍 QUERY PARAMETERS:");
        console.log(JSON.stringify(event.queryStringParameters, null, 4));
    }
    
    console.log("\n" + "=".repeat(50));
    console.log("✅ Lambda execution completed");
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Data logged successfully - check CloudWatch logs',
            timestamp: new Date().toISOString()
        }, null, 2)
    };
};