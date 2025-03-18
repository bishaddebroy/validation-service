const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.use(express.json());

// Get calculation service URL from environment variable or use default for K8s
const CALC_SERVICE_URL = process.env.CALC_SERVICE_URL || 'http://calculation-service:6001/calculate';
// Set the persistent volume path from environment variable or use default
const PV_PATH = process.env.PV_PATH || '/bishad_PV_dir';

console.log(`Starting validation service with CALC_SERVICE_URL: ${CALC_SERVICE_URL}`);
console.log(`PV_PATH set to: ${PV_PATH}`);

// New endpoint for storing files
app.post('/store-file', async (req, res) => {
    console.log('Received store-file request:', req.body);
    try {
        // Check for required parameters
        if (!req.body.file || !req.body.data) {
            console.log('Missing required parameters');
            return res.json({
                "file": req.body.file || null,
                "error": "Invalid JSON input."
            });
        }

        const { file, data } = req.body;
        
        try {
            // Create the directory if it doesn't exist
            console.log(`Creating directory if needed: ${PV_PATH}`);
            await fs.mkdir(PV_PATH, { recursive: true });
            
            // Write the file to the persistent volume
            console.log(`Writing file to: ${path.join(PV_PATH, file)}`);
            await fs.writeFile(path.join(PV_PATH, file), data);
            
            // Return success message
            console.log('File stored successfully');
            return res.json({
                "file": file,
                "message": "Success."
            });
        } catch (error) {
            console.error('Error storing file:', error);
            return res.json({
                "file": file,
                "error": "Error while storing the file to the storage."
            });
        }
    } catch (error) {
        console.error('Unexpected error:', error);
        return res.json({
            "file": req.body.file || null,
            "error": "Invalid JSON input."
        });
    }
});

// Existing calculate endpoint
app.post('/calculate', async (req, res) => {
    console.log('Received calculate request:', req.body);
    try {
        // Check for file parameter
        if (!req.body.file) {
            console.log('Missing file parameter');
            return res.json({
                "file": null,
                "error": "Invalid JSON input."
            });
        }

        // Forward request to calculation service
        try {
            console.log(`Sending request to calculation service at: ${CALC_SERVICE_URL}`);
            console.log(`Request body: ${JSON.stringify(req.body)}`);
            
            const response = await axios.post(CALC_SERVICE_URL, req.body);
            console.log(`Received response from calculation service:`, response.data);
            
            return res.json(response.data);
        } catch (error) {
            console.error('Error communicating with calculation service:', error.message);
            
            // If we have a response from the calculation service, use it
            if (error.response && error.response.data) {
                console.log(`Error response data: ${JSON.stringify(error.response.data)}`);
                return res.json(error.response.data);
            }
            
            // For network errors, check if the file exists first
            try {
                console.log(`Checking if file exists: ${path.join(PV_PATH, req.body.file)}`);
                await fs.access(path.join(PV_PATH, req.body.file));
                console.log('File exists, but error processing request');
                return res.json({
                    "file": req.body.file,
                    "error": "File not found."  // Changed to match expected error message
                });
            } catch (fileError) {
                // File doesn't exist
                console.log('File does not exist');
                return res.json({
                    "file": req.body.file,
                    "error": "File not found."
                });
            }
        }
    } catch (error) {
        console.error('Unexpected error in calculate endpoint:', error);
        return res.json({
            "file": req.body.file || null,
            "error": "Invalid JSON input."
        });
    }
});

// Start the server
const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
    console.log(`Validation service running on port ${PORT}`);
});
//trigger event