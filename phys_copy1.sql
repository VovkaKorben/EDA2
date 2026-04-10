/*
 Navicat Premium Data Transfer

 Source Server         : EDA2
 Source Server Type    : SQLite
 Source Server Version : 3035005 (3.35.5)
 Source Schema         : main

 Target Server Type    : SQLite
 Target Server Version : 3035005 (3.35.5)
 File Encoding         : 65001

 Date: 09/04/2026 19:07:28
*/

PRAGMA foreign_keys = false;

-- ----------------------------
-- Table structure for phys_copy1
-- ----------------------------
DROP TABLE IF EXISTS "phys_copy1";
CREATE TABLE "phys_copy1" (
  "packageId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "typeId" integer NOT NULL,
  "name" TEXT,
  "pins" TEXT,
  "textPos" TEXT,
  "turtle" TEXT,
  CONSTRAINT "fk_ref_elem" FOREIGN KEY ("typeId") REFERENCES "library" ("typeId") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ----------------------------
-- Records of phys_copy1
-- ----------------------------
INSERT INTO "phys_copy1" VALUES (1, 3, 'BC547C', 'E: 2.54, 0; B: 1.27, 0; C: 0, 0', '1.27, -2.8', 'P(3.1674,-1.3,3.57,0,1.27,2.3,-1.03,0,-0.6274,-1.3);
P(-0.6274,-1.3,3.1674,-1.3);');
INSERT INTO "phys_copy1" VALUES (7, 13, 'PVC-2L20T', 'PIN1: 15.24, 15.24; PIN2: 0, 15.24; PIN3: 15.24, 0; PIN4: 0, 0', '7.62, 7.62', 'P(-2.88,-2.88,18.12,-2.88,18.12,18.12,0.2554,18.12,-2.88,14.9845);');
INSERT INTO "phys_copy1" VALUES (8, 18, 'Bourns PTV09', 'PIN1: 5.08, 0; PIN2: 2.54, 0; PIN3: 0, 0', '2.4487, -6.25', 'P(-3.2513,-12.5,8.1487,-12.5,8.1487,0,-3.2513,0);');
INSERT INTO "phys_copy1" VALUES (9, 3, '2N2222', 'E: 2.54, 0; B: 1.27, 0; C: 0, 0', '1.27, -2.8', 'A(1.27,0,2.54,-30,210,1);');
INSERT INTO "phys_copy1" VALUES (10, 3, '2N3904', 'E: 2.54, 0; B: 1.27, 0; C: 0, 0', '1.27, -2.8', 'P(3.1674,-1.3,3.57,0,1.27,2.3,-1.03,0,-0.6274,-1.3);
P(-0.6274,-1.3,3.1674,-1.3);');
INSERT INTO "phys_copy1" VALUES (11, 18, 'Alps RK09', 'PIN1: 5.08, 0; PIN2: 2.54, 0; PIN3: 0, 0', '2.4487, -6.25', 'P(-3.2513,-12.5,8.1487,-12.5,8.1487,0,-3.2513,0);');
INSERT INTO "phys_copy1" VALUES (12, 1, 'CFR-25', 'PIN1: 10.16, 0; PIN2: 0, 0', '5.08, 0', 'P(1.93,-1.2,8.23,-1.2,8.23,1.2,1.93,1.2);');
INSERT INTO "phys_copy1" VALUES (13, 1, 'MF-25', 'PIN1: 10.16, 0; PIN2: 0, 0', '5.08, 0', 'P(1.93,-1.2,8.23,-1.2,8.23,1.2,1.93,1.2);');
INSERT INTO "phys_copy1" VALUES (14, 15, 'DG301', 'PIN1: 5.08, 0; PIN2: 0, 0', '2.54, -8.16', 'P(-3.71,1.5574,-3.71,-5,8.79,-5,8.79,5,-0.2673,5);');
INSERT INTO "phys_copy1" VALUES (15, 15, 'KF301', 'PIN1: 5.08, 0; PIN2: 0, 0', '2.54, -8.16', 'P(-3.71,1.5574,-3.71,-5,8.79,-5,8.79,5,-0.2673,5);');
INSERT INTO "phys_copy1" VALUES (16, 20, 'DG301', 'PIN1: 5.08, 0; PIN2: 0, 0', '2.54, -8.16', 'P(-3.71,1.5574,-3.71,-5,8.79,-5,8.79,5,-0.2673,5);');
INSERT INTO "phys_copy1" VALUES (17, 20, 'KF301', 'PIN1: 5.08, 0; PIN2: 0, 0', '2.54, -8.16', 'P(-3.71,1.5574,-3.71,-5,8.79,-5,8.79,5,-0.2673,5);');
INSERT INTO "phys_copy1" VALUES (18, 14, 'SK12D07', 'PIN1: 2.54, 0; PIN2: 5.08, 0; PIN3: 0, 0', '2.54, 3.5', 'P(4.7068,-4.06,5.4528,-4.06,5.4528,-2.79,4.7068,-2.79);
P(-0.3861,-3.6472,0,-4.06,0,-2.79);
P(-1.46,-2,6.54,-2,6.54,2,-1.46,2);');
INSERT INTO "phys_copy1" VALUES (19, 14, 'MSS-12D07', 'PIN1: 2.54, 0; PIN2: 5.08, 0; PIN3: 0, 0', '2.54, 3.5', 'P(4.7068,-4.06,5.4528,-4.06,5.4528,-2.79,4.7068,-2.79);
P(-0.3861,-3.6472,0,-4.06,0,-2.79);
P(-1.46,-2,6.54,-2,6.54,2,-1.46,2);');
INSERT INTO "phys_copy1" VALUES (20, 13, 'Polyvaricon', 'PIN1: 15.24, 15.24; PIN2: 0, 15.24; PIN3: 15.24, 0; PIN4: 0, 0', '7.62, 7.62', 'P(-2.88,-2.88,18.12,-2.88,18.12,18.12,0.2554,18.12,-2.88,14.9845);');
INSERT INTO "phys_copy1" VALUES (21, 2, 'cond', 'PIN1: 5.08, 0; PIN2: 0, 0', '2.54, 0', 'P(-1.21,1.25,-1.21,-1.25,6.29,-1.25,6.29,1.25);');
INSERT INTO "phys_copy1" VALUES (22, 5, 'BC555C', 'E: 2.54, 0; B: 1.27, 0; C: 0, 0', '1.27, -2.8', 'P(3.1674,-1.3,3.57,0,1.27,2.3,-1.03,0,-0.6274,-1.3);
P(-0.6274,-1.3,3.1674,-1.3);');
INSERT INTO "phys_copy1" VALUES (23, 19, 'ANT', 'PIN1: 0, 0', '0, 1.9547', 'P(0.4536,-0.5272,0.4536,-1.0715);
P(0.2721,-1.0715,0.635,-1.0715);
P(-0.1814,-1.0715,0.1814,-0.5272,0.1814,-1.0715);
P(-0.1814,-0.5272,-0.1814,-1.0715);
P(-0.5443,-0.7993,-0.3629,-0.7993);
P(-0.635,-0.5272,-0.4536,-1.0715,-0.2721,-0.5272);');
INSERT INTO "phys_copy1" VALUES (24, 17, 'COIL', 'PIN1: 11.43, 0; PIN2: 0, 0', '5.715, 1.8319', 'A(1.4287,0,1.4287);
A(4.2862,0,1.4287);
A(7.1437,0,1.4287);
A(1.4287,0,1.4287);');
INSERT INTO "phys_copy1" VALUES (25, 21, 'PolarCap', 'C: 2.54, 0; A: 0, 0', '-2.875, -2.135', 'P(-2.875,-0.635,-2.875,0.635);
P(-2.24,0,-3.51,0);
A(0,1.27,2.5);');

-- ----------------------------
-- Auto increment value for phys_copy1
-- ----------------------------
UPDATE "sqlite_sequence" SET seq = 25 WHERE name = 'phys_copy1';

PRAGMA foreign_keys = true;
