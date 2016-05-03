/*
Copyright (c) 2016, Tim Düsterhus
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const panic = () => { throw new Error("Cowardly refusing to keep the process alive as root") }
if ((process.getuid && process.getuid() === 0) || (process.getgid && process.getgid() === 0)) panic()

process.on('SIGINT', () => process.exit(0))
process.on('SIGTERM', () => process.exit(0))

const debug      = require('debug')('csp')
const config     = require('rc')('csp', { bind: { port: 9001
                                                , host: '0.0.0.0'
                                                }
                                        , mail: { transport: null
                                                , from: null
                                                , to: null
                                                }
                                        , dedup: 5000
                                        }
                                )
const express    = require('express')
const nodemailer = require('nodemailer')
const lruCache   = require('lru-cache')

if (!config.mail.transport || !config.mail.from || !config.mail.to) {
        console.error('You need to configure a mail transport, a mail from and a mail to.')
        process.exit(1)
}

process.title = `CSP ${config.bind.host}:${config.bind.port}`

debug(`CSP ${config.bind.host}:${config.bind.port}`)

const app = express()
const mailTransport = nodemailer.createTransport(config.mail.transport)
const deduper = lruCache(config.dedup)

app.use(require('body-parser').json({ type: ['json', 'application/csp-report'] }))

app.post('/', (req, res) => {
        if (req.body) {
                const mail = { from: config.mail.from
                             , to: config.mail.to
                             , subject: `CSP violation`
                             , text: JSON.stringify(req.body)
                             }
                if (deduper.has(mail.text)) {
                        debug('Report is a dupe')
                        res.sendStatus(201)
                        return
                }

                deduper.set(mail.text, true)
                mailTransport.sendMail(mail, (err, info) => {
                        debug(info)
                        if (err) {
                                console.error(err)
                                res.sendStatus(500)
                        }
                        else {
                                res.sendStatus(201)
                        }
                })
        }
        else {
                res.sendStatus(400)
        }
})

app.listen(config.bind.port, config.bind.host)
