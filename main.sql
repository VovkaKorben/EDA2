/*
 Navicat Premium Data Transfer

 Source Server         : EDA
 Source Server Type    : SQLite
 Source Server Version : 3035005 (3.35.5)
 Source Schema         : main

 Target Server Type    : SQLite
 Target Server Version : 3035005 (3.35.5)
 File Encoding         : 65001

 Date: 01/02/2026 21:18:12
*/

PRAGMA foreign_keys = false;

-- ----------------------------
-- Table structure for library
-- ----------------------------
DROP TABLE IF EXISTS "library";
CREATE TABLE "library" (
  "typeId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "name" TEXT,
  "abbr" TEXT,
  "turtle" TEXT,
  "pins" TEXT,
  "descr" TEXT
);

-- ----------------------------
-- Records of library
-- ----------------------------
INSERT INTO "library" VALUES (1, 'resistor', 'R', 'R(-5,-2,10,4);L(-10,0,-5,0);L(5,0,10,0);', '0:-10,0;1:10,0', 'A resistor is a passive component that reduces voltage or limits the current flowing through a circuit.');
INSERT INTO "library" VALUES (2, 'capacitor', 'C', 'L(-1,-4,-1,4);L(1,-4,1,4);L(-6,0,-1,0);L(1,0,5,0);', '0:-6,0;1:6,0', 'A capacitor is a passive, two-terminal electronic component that stores electrical energy in an electric field by accumulating charge on two conductive plates separated by an insulating dielectric material');
INSERT INTO "library" VALUES (3, 'transistor', 'VT', 'L(-11,0,-2,0);L(-2,-4,-2,4);
L(2,10.66,2,5.66);L(2,-5.66,2,-10.66);
C(0,0,6);
L(-2,-1.748,2,-5.66);
P(-2,1.749,0.122,2.456,-1.292,3.87,2);L(-2,1.749,2,5.66);
', '0:-11,0;1:2,10.66;2:2,-10.66;', 'A transistor is a fundamental semiconductor device used to amplify or switch electrical signals and power, serving as a building block for modern electronics.');
INSERT INTO "library" VALUES (4, 'diode', 'VD', 'P(-2.5,-2.5,2.5,0,-2.5,2.5,1);
L(-7.5,0,7.5,0);
L(2.5,2.5,2.5,-2.5);', '0:-7.5,0;1:7.5,0;', 'A diode is a semiconductor device, typically made of silicon, that essentially acts as a one-way switch for current.');
INSERT INTO "library" VALUES (5, 'test', 'test', NULL, NULL, 'test');

-- ----------------------------
-- Table structure for phys
-- ----------------------------
DROP TABLE IF EXISTS "phys";
CREATE TABLE "phys" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "typeId" integer NOT NULL,
  "name" TEXT NOT NULL,
  "w" real NOT NULL,
  "h" real NOT NULL,
  "pins" TEXT NOT NULL,
  CONSTRAINT "fk_ref_elem" FOREIGN KEY ("typeId") REFERENCES "library" ("typeId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------
-- Records of phys
-- ----------------------------
INSERT INTO "phys" VALUES (1, 3, 'trans1', 5.0, 3.0, '3');
INSERT INTO "phys" VALUES (2, 3, 'trans2', 5.0, 5.0, '3');
INSERT INTO "phys" VALUES (3, 3, 'trans3', 5.0, 7.0, '3');
INSERT INTO "phys" VALUES (4, 1, 'res1', 3.0, 11.0, '2');
INSERT INTO "phys" VALUES (5, 1, 'res2', 3.0, 11.0, '2');
INSERT INTO "phys" VALUES (6, 1, 'res3', 3.0, 11.0, '2');

-- ----------------------------
-- Table structure for sqlite_sequence
-- ----------------------------
DROP TABLE IF EXISTS "sqlite_sequence";
CREATE TABLE "sqlite_sequence" (
  "name",
  "seq"
);

-- ----------------------------
-- Records of sqlite_sequence
-- ----------------------------
INSERT INTO "sqlite_sequence" VALUES ('library', 5);
INSERT INTO "sqlite_sequence" VALUES ('phys', 6);

-- ----------------------------
-- Auto increment value for library
-- ----------------------------
UPDATE "sqlite_sequence" SET seq = 5 WHERE name = 'library';

-- ----------------------------
-- Auto increment value for phys
-- ----------------------------
UPDATE "sqlite_sequence" SET seq = 6 WHERE name = 'phys';

PRAGMA foreign_keys = true;
