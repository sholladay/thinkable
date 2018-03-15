import test from 'ava';
import r from 'rethinkdb';
import { init, cleanup } from '.';

const seed = {
    mydb : {
        users : [
            { name : 'Jane' },
            { name : 'John' }
        ],
        suppliers : [
            { name : 'E Corp' },
            { name : 'Buy n Large' }
        ]
    },
    otherdb : {
        landmarks : [
            { location : 'Boston' }
        ],
        events : [
            {
                location : 'Cambridge',
                date     : '2025-02-19'
            }
        ]
    }
};

test.before(init(seed));
test.after.always(cleanup);

test('basics via default port', async (t) => {
    const conn = await r.connect();
    const databases = await r.dbList().run(conn);
    t.deepEqual(databases, ['mydb', 'otherdb', 'rethinkdb', 'test']);
    const mydbTables = await r.db('mydb').tableList().run(conn);
    t.deepEqual(mydbTables, ['suppliers', 'users']);
    const otherdbTables = await r.db('otherdb').tableList().run(conn);
    t.deepEqual(otherdbTables, ['events', 'landmarks']);
    const boston = await r.db('otherdb').table('events').filter({ location : 'Cambridge' }).nth(0).run(conn);

    t.is(Object.keys(boston).length, 3);
    t.is(typeof boston.id, 'string');
    t.is(boston.id.length, 36);
    t.is(boston.location, 'Cambridge');
    t.is(boston.date, '2025-02-19');
});

test('port is set on context for convenience', async (t) => {
    t.true(Number.isSafeInteger(t.context.dbPort));
    t.true(t.context.dbPort > 0);
    t.true(t.context.dbPort < 65536);
    const conn = await r.connect({
        port : t.context.dbPort
    });
    const databases = await r.dbList().run(conn);
    t.deepEqual(databases, ['mydb', 'otherdb', 'rethinkdb', 'test']);
});

test('driver and context have consistent port', (t) => {
    t.is(t.context.dbPort, r.net.Connection.prototype.DEFAULT_PORT);
});
