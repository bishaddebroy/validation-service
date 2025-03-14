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

// New endpoint for storing files
app.post('/store-file', async (req, res) => {
    try {
        // Check for required parameters
        if (!req.body.file || !req.body.data) {
            return res.json({
                "file": req.body.file || null,
                "error": "Invalid JSON input."
            });
        }

        const { file, data } = req.body;
        
        try {
            // Create the directory if it doesn't exist
            await fs.mkdir(PV_PATH, { recursive: true });
            
            // Write the file to the persistent volume
            await fs.writeFile(path.join(PV_PATH, file), data);
            
            // Return success message
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
    try {
        // Check for file parameter
        if (!req.body.file) {
            return res.json({
                "file": null,
                "error": "Invalid JSON input."
            });
        }

        // Forward request to calculation service
        try {
            const response = await axios.post(CALC_SERVICE_URL, req.body);
            res.json(response.data);
        } catch (error) {
            if (error.response && error.response.data) {
                res.json(error.response.data);
            } else {
                res.json({
                    "file": req.body.file,
                    "error": "Error processing request"
                });
            }
        }
    } catch (error) {
        res.json({
            "file": null,
            "error": "Invalid JSON input."
        });
    }
});

// Start the server
const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
    console.log(`Validation service running on port ${PORT}`);
});