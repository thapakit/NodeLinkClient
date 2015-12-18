angular.module('app.services.Main', [])
    .factory('MainService', function($q, $http) {

        var cryptoHash = require('crypto');

        var configFile = ipc.sendSync('get-config-file');
        var config = fse.readJsonSync(configFile);
        var cloudConfig = config.cloud;
        var cloudUrl = cloudConfig.url + ':' + parseInt(cloudConfig.port);
        var cloudUser = cloudConfig.user;
        var cloudPassword = cryptoHash.createHash('md5').update(cloudConfig.password).digest('hex');

        var db = require('knex')({
            client: 'mysql',
            connection: config.db
        });

        return {

            list: function(date) {

                var q = $q.defer();

                var sql = 'select (select hospitalcode from opdconfig limit 1) as hospcode, ' +
                    'ed.vn, o.hn, o.vstdate, o.vsttime, p.cid, ed.trauma, et.er_accident_type_name, ' +
                    'ev.visit_name, ed.arrive_time, p.pname, p.fname, p.lname, p.sex, p.birthday, ' +
                    'ed.er_accident_type_id, ed.visit_type, na.vn as nodedetail ' +
                    'from er_nursing_detail as ed  ' +
                    'inner join ovst as o on o.vn=ed.vn ' +
                    'inner join patient as p on p.hn=o.hn  ' +
                    'left join er_accident_type as et on et.er_accident_type_id=ed.er_accident_type_id ' +
                    'left join node_accident as na on na.vn=ed.vn ' +
                    'left join er_nursing_visit_type as ev on ev.visit_type=ed.visit_type ' +
                    'where ed.er_accident_type_id is not null and o.vstdate=? order by o.vsttime desc';

                //db.raw('set NAMES \'utf8\'', [])
                //    .then(function(rows) {
                //
                //    })
                //    .catch(function(err) {
                //        q.reject(err)
                //    });

                db.raw('set NAMES \'utf8\'', [])
                    .then(function(rows) {
                        db.raw(sql, [date])
                            .then(function(rows) {
                                q.resolve(rows[0])
                            })
                            .catch(function(err) {
                                q.reject(err)
                            });
                    })
                    .catch(function(err) {
                        q.reject(err)
                    });

                return q.promise;
            },

            getHospitalCode: function () {
                var q = $q.defer();

                db.raw('set NAMES \'utf8\'', [])
                    .then(function(rows) {
                        db('opdconfig')
                            .select('hospitalcode')
                            .limit(1)
                            .then(function(rows) {
                                q.resolve(rows[0].hospitalcode)
                            })
                            .catch(function(err) {
                                q.reject(err)
                            });
                    })
                    .catch(function(err) {
                        q.reject(err)
                    });

                return q.promise;
            },

            send: function(data) {

                var q = $q.defer();
                var params = {
                    user: cloudUser,
                    password: cloudPassword,
                    data: data
                };

                $http.post(cloudUrl + '/save', params)
                    .success(function(data) {
                        q.resolve();
                    })
                    .error(function(err) {
                        q.reject(err);
                        console.log(err);
                    });

                return q.promise;
            },

            getSendHistory: function(date, hcode) {
                var q = $q.defer();
                $http.post(cloudUrl + '/send_history', {
                    date: date,
                    user: cloudUser,
                    password: cloudPassword,
                    hcode: hcode
                })
                    .success(function(data) {
                        q.resolve(data);
                    })
                    .error(function(err) {
                        q.reject(err);
                        console.log(err);
                    });

                return q.promise;
            },

            getExport: function (vn) {
                var q = $q.defer();

                //var sql = 'SELECT  DISTINCT ' +
                //    '   (SELECT hospitalcode FROM opdconfig) AS hcode,  ' +
                //    '   p.person_id AS pid, ' +
                //    'p.pname as prename, p.fname as firstname, p.lname as lastname, ' +
                //    ' p.sex, ' +
                //    ' p.birthdate AS dob, ' +
                //    '  timestampdiff(year, p.birthdate, v.vstdate) as age, ' +
                //    '  v.hn, v.vn, p.nationality, ' +
                //    '   na.adate, ' +
                //    ' na.atime, ' +
                //    ' o.vstdate as hdate, ' +
                //    ' o.vsttime as htime, ' +
                //    ' "" as ddate,  ' +
                //    ' "" as dtime,  ' +
                //    '  na.acc_prov,  ' +
                //    ' na.acc_amp,  ' +
                //    ' na.acc_tam,   ' +
                //    ' "" as typepass, ' +
                //    'na.vehicle1, ' +
                //    'na.vehicle2, ' +
                //    ' "" as icd10, ' +
                //    'na.road, ' +
                //    'na.road_area, ' +
                //    'na.type_road, ' +
                //    '   "9" AS belt,  ' +
                //    '   "9" AS helmet,  ' +
                //    '      "9" AS alcohol,  ' +
                //    '   IFNULL(r.accident_transport_type_id,99) AS  carry, o.vstdate ' +
                //    '   FROM er_nursing_detail r  ' +
                //    '   inner join ovst o on o.vn=r.vn  ' +
                //    '   inner join vn_stat v on v.vn=r.vn  ' +
                //    '   LEFT OUTER JOIN person p ON v.hn = p.patient_hn  ' +
                //    '   LEFT OUTER JOIN er_regist er ON r.vn =er.vn AND v.vn=er.vn  ' +
                //    '   left outer join node_accident na  on na.vn=o.vn ' +
                //    '   WHERE r.er_accident_type_id IS NOT NULL AND v.vn IS NOT NULL  ' +
                //    'and o.vn in (?)';

                var sql =
                    'SELECT DISTINCT ' +
                    '( ' +
                    '    SELECT ' +
                    '       hospitalcode ' +
                    '    FROM ' +
                    '       opdconfig ' +
                    ')AS hcode, ' +
                    '    p.person_id AS pid, ' +
                    'case when p.pname is null then pa.pname else p.pname end AS prename, ' +
                    'case when p.fname is null then pa.fname else p.fname end AS firstname, ' +
                    'case when p.lname is null then pa.lname else p.lname end AS lastname, ' +
                    'case when p.sex is null then pa.sex else p.sex end as sex, ' +
                    'case when p.birthdate is null then pa.birthday else p.birthdate end AS dob, ' +
                    '    timestampdiff(YEAR, case when p.birthdate is null then pa.birthday else p.birthdate end, v.vstdate)AS age, ' +
                    '    v.hn, ' +
                    '    v.vn, ' +
                    'case when p.nationality is null then pa.nationality else p.nationality end as nationality, ' +
                    '    na.adate, ' +
                    '    na.atime, ' +
                    '    o.vstdate AS hdate, ' +
                    '    o.vsttime AS htime, ' +
                    '    "" AS ddate, ' +
                    '    "" AS dtime, ' +
                    '    na.acc_prov, ' +
                    '    na.acc_amp, ' +
                    '    na.acc_tam, ' +
                    '    "" AS typepass, ' +
                    '    na.vehicle1, ' +
                    '    na.vehicle2, ' +
                    '    "" AS icd10, ' +
                    '    na.road, ' +
                    '    na.road_area, ' +
                    '    na.type_road, ' +
                    '    "9" AS belt, ' +
                    '    "9" AS helmet, ' +
                    '    "9" AS alcohol, ' +
                    '    IFNULL( ' +
                    '        r.accident_transport_type_id, ' +
                    '        99 ' +
                    '    )AS carry, ' +
                    '    o.vstdate, ' +
                    '    r.trauma ' +
                    'FROM ' +
                    'er_nursing_detail r ' +
                    'INNER JOIN ovst o ON o.vn = r.vn ' +
                    'INNER JOIN vn_stat v ON v.vn = r.vn ' +
                    'LEFT OUTER JOIN person p ON v.hn = p.patient_hn ' +
                    'LEFT JOIN patient as pa on v.hn=pa.hn ' +
                    'LEFT OUTER JOIN er_regist er ON r.vn = er.vn ' +
                    'AND v.vn = er.vn ' +
                    'LEFT OUTER JOIN node_accident na ON na.vn = o.vn ' +
                    'WHERE ' +
                    'r.er_accident_type_id IS NOT NULL ' +
                    'AND v.vn IS NOT NULL ' +
                    'AND o.vn IN(?)';

                db.raw('set NAMES \'utf8\'', [])
                    .then(function(rows) {
                        db.raw(sql, [vn])
                            .then(function (rows) {
                                q.resolve(rows[0])
                            })
                            .catch(function (err) {
                                q.reject(err)
                            });
                    })
                    .catch(function(err) {
                        q.reject(err)
                    });

                return q.promise;
            }
        }
    });
