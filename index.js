'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const util = require('util');
const joi = require('joi');
const r = require('rethinkdb');
const execa = require('execa');
const pEvent = require('p-event');
const mkdirtemp = require('mkdirtemp');
const tempWrite = require('temp-write');
const isPathInside = require('is-path-inside');
const rimraf = util.promisify(require('rimraf'));

const pathExists = (filepath) => {
    return new Promise((resolve) => {
        fs.access(filepath, (err) => {
            resolve(!err);
        });
    });
};

const isSafePath = (filepath) => {
    return isPathInside(filepath, process.cwd()) || isPathInside(filepath, os.tmpdir());
};

const del = async (filepath) => {
    if (!isSafePath(filepath)) {
        throw new Error(`Refusing to delete file outside of the cwd: ${filepath}`);
    }
    await rimraf(filepath, { glob : false });
};

let cwd;
let server;

const init = (seed, option) => {
    const config = joi.attempt({ ...option }, joi.object().required().keys({
        cwd      : joi.string().optional(),
        password : joi.string().optional()
    }));
    const { password } = config;
    if (password === 'auto') {
        throw new Error('Auto generated password not yet supported');
    }

    return async (t) => {
        const ephemeralDir = await mkdirtemp();
        cwd = path.resolve(config.cwd || ephemeralDir);
        if (!isSafePath(cwd)) {
            throw new Error(`Refusing to use a directory outside of the cwd: ${cwd}`);
        }
        if (config.cwd && await pathExists(config.cwd)) {
            throw new Error(`Refusing to use existing directory: ${cwd}`);
        }

        const args = ['--no-http-admin', '--no-update-check', '--directory', cwd, '--driver-port', 0, '--cluster-port', 0];
        if (password) {
            args.push('--initial-password', password);
        }
        server = execa('rethinkdb', args, {
            preferLocal : false
        });
        server.on('error', (err) => {
            throw err;
        });

        let port;
        let buffered = '';

        await pEvent(server.stdout, 'data', {
            filter(chunk) {
                buffered += chunk.toString('utf8');
                if (!port) {
                    const matches = buffered.match(/Listening for client driver connections on port (\d+)/u);
                    if (matches && matches[1]) {
                        port = Number.parseInt(matches[1], 10);
                    }
                }
                return buffered.includes('Server ready,');
            },
            timeout : 20000
        });

        if (!Number.isSafeInteger(port)) {
            throw new TypeError('Unable to determine RethinkDB port to connect to');
        }

        const conn = await r.connect({
            port,
            password
        });

        await Promise.all(Object.keys(seed).map(async (db) => {
            if (db !== 'test') {
                await r.dbCreate(db).run(conn);
            }
            await Promise.all(Object.entries(seed[db]).map(async ([table, docs]) => {
                await r.db(db).tableCreate(table).run(conn);
                await Promise.all(docs.map(async (doc) => {
                    await r.db(db).table(table).insert(doc).run(conn);
                }));
            }));
        }));
        r.net.Connection.prototype.DEFAULT_PORT = port;
        t.context.dbPort = port;
    };
};
const restore = async (option) => {
    const config = joi.attempt({ ...option }, joi.object().required().keys({
        port     : joi.number().optional(),
        dump     : joi.string().required(),
        password : joi.string().optional()
    }));

    const args = ['restore', config.dump];
    if (config.password) {
        const filepath = await tempWrite(config.password);
        args.push('--password-file', filepath);
    }
    if (config.port) {
        args.push('--connect', `localhost:${config.port}`);
    }
    await execa('rethinkdb', args, {
        preferLocal : false
    });
};

const cleanup = async () => {
    if (server) {
        server.kill();
    }
    await del(cwd);
};

module.exports = {
    init,
    restore,
    cleanup
};
