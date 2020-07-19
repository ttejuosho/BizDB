let chai = require('chai');
let chaiHttp = require('chai-http');
var should = chai.should();
chai.use(chaiHttp);
let server = require('../server');

describe('Business', () => {
    describe('getBusinessById', () => {
        it('it will get Business by Id', (done) => {
            chai.request(server).get('/getBusiness/:id').end((err, res) => {
                (res).should.have.status(200);
                (res.body).should.be.a('array');
                (res.body.length).should.be.eql(1);
                done();
            });
        });
    });
});