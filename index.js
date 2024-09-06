const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const {GridFsStorage} = require('multer-gridfs-storage');
const crypto = require('crypto');
const path = require('path');

const app = express();

const mongoURI = 'mongodb://localhost:27017/gridfs';
mongoose.connect(mongoURI, {useNewUrlParser: true, useUnifiedTopology: true});
const conn = mongoose.connection;

let bucket;
conn.once('open', () => {
    bucket = new mongoose.mongo.GridFSBucket(conn.db, {
        bucketName: 'uploads'
    });
});

const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return new Promise((resolve, reject) => {
            crypto.randomBytes(16, (err, buf) => {
                if (err) {
                    return reject(err);
                }
                const filename = buf.toString('hex') + path.extname(file.originalname);
                const fileInfo = {
                    filename: filename,
                    bucketName: 'uploads'
                };
                resolve(fileInfo);
            });
        });
    }});

    const upload = multer({ 
        storage:storage,fileFilter: (req, file, cb) => {
        cb(null, true);
    }}).any();

    app.use((req,res,next) => {
        console.log("Nuevo request",)
        console.log("Method",req.method)
        console.log("Path",req.path)
        console.log("Headers",req.headers)
        next()
    })

    app.post('/upload',(req,res) => {
        upload(req,res, function (err) {
            if( err instanceof multer.MulterError){
                return res.status(500).json(err)
            } else if(err){
                return res.status(500).json(err)
            }
            console.log("Files: ", req.files)
            console.log("Body: ", req.body)

            if(!req.files || req.files.length === 0){
                return res.status(400).send("No files were uploaded.")
            }
            res.json({file:req.files})

        })
    })

    app.get('/image/:filename',(req,res) => {
        bucket.find({filename:req.params.filename}).toArray((err,files) => {
            if(!files || files.length === 0){
                return res.status(404).json({
                    err:"No files exist"
                })
            }
            const file = files[0]
            if(file.contentType === 'image/jpeg' || file.contentType === 'image/png'){
                const readStream = bucket.openDownloadStream(file._id)

                let base64Image = ''

                readStream.on('data',(chunk) => {
                    base64Image += chunk.toString('base64')
                })

                readStream.on('end',() => {
                    res.json({
                        filename:file.filename,
                        contentType:file.contentType,
                        size:file.length,
                        upload: file.uploadDate,
                        image:`data:${file.contentType};base64,${base64Image}`
                    })
                })

                readStream.on('error',() => {
                    return res.status(500).json({
                        err:err
                    })
                })
                

            }else{
                res.status(404).json({
                    err:'Not an image'
                })
            }
        })
    })

    const port = 2000
    app.listen(port,() => {
        console.log(`Server running on port ${port}`)
    })