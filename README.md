# thinkable [![Build status for Thinkable](https://img.shields.io/circleci/project/sholladay/thinkable/master.svg "Build Status")](https://circleci.com/gh/sholladay/thinkable "Builds")

> Helpers for testing [RethinkDB](https://rethinkdb.com/) apps with [AVA](https://github.com/avajs/ava)

## Why?

 - Initializes and cleans up the database.
 - Each test worker gets its own isolated database.
 - Easily seed the database and configure it.

## Install

```sh
npm install thinkable --save-dev
```

## Usage

```js
import test from 'ava';
import r from 'rethinkdb';
import { init, cleanup } from 'thinkable';

const seed = {
    dbOne : {
        tableA : [
            { name : 'Jane Doe' }
        ]
    },
    dbTwo : {
        tableA : [
            { color : 'blue' }
        ]
    }
};

test.before(init(seed));
test.after.always(cleanup);

test('does some stuff', async (t) => {
    const conn = await r.connect({
        port : t.context.dbPort
    });
    console.log(await r.dbList().run(conn));
});
```

## API

### init(seed)

Returns an async function that is meant to be passed as `fn` to AVA's `test.before(fn)`. The returned function, when called, starts and seeds the database.

### cleanup()

Stops the database and cleans up its data.

## Contributing

See our [contributing guidelines](https://github.com/sholladay/thinkable/blob/master/CONTRIBUTING.md "Guidelines for participating in this project") for more details.

1. [Fork it](https://github.com/sholladay/thinkable/fork).
2. Make a feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. [Submit a pull request](https://github.com/sholladay/thinkable/compare "Submit code to this project for review").

## License

[MPL-2.0](https://github.com/sholladay/thinkable/blob/master/LICENSE "License for thinkable") © [Seth Holladay](https://seth-holladay.com "Author of thinkable")

Go make something, dang it.
