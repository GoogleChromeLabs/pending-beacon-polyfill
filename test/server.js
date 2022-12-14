/*
 Copyright 2022 Google Inc. All Rights Reserved.
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
*/

import bodyParser from 'body-parser';
import express from 'express';
import fs from 'fs-extra';
import nunjucks from 'nunjucks';

const BEACON_FILE = 'test/beacons.log';
const app = express();

nunjucks.configure('./test/views/', {noCache: true});

// Turn off all caching for tests.
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});

// Allow the use of a `delay` query param to delay any response.
app.use((req, res, next) => {
  if (req.query && req.query.delay) {
    setTimeout(next, req.query.delay);
  } else {
    next();
  }
});

// Add a "collect" endpoint to simulate analytics beacons.
app.post('/collect', bodyParser.text(), (req, res) => {
  const body = typeof req.body === 'string' ? req.body : '';

  if (body.trim().match(/^[{[]/)) {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  } else {
    console.log(body);
  }

  console.log('-'.repeat(80));
  fs.appendFileSync(BEACON_FILE, req.body + '\n');

  res.end();
});

app.get('/test/:view', function (req, res) {
  const data = {...req.query};
  const content = nunjucks.render(`${req.params.view}.njk`, data);
  res.send(content);
});

app.use(express.static('./'));

const listener = app.listen(process.env.PORT || 9090, () => {
  fs.ensureFileSync(BEACON_FILE);
  console.log(`Server running:\nhttp://localhost:${listener.address().port}`);
});
