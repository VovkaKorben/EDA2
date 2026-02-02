const lib = "{
    "1": {
        "typeId": 1,
        "name": "resistor",
        "abbr": "R",
        "turtle": [
            {
                "code": "R",
                "params": [
                    -5,
                    -2,
                    10,
                    4
                ]
            },
            {
                "code": "L",
                "params": [
                    -10,
                    0,
                    -5,
                    0
                ]
            },
            {
                "code": "L",
                "params": [
                    5,
                    0,
                    10,
                    0
                ]
            }
        ],
        "pins": {
            "0": [
                -10,
                0
            ],
            "1": [
                10,
                0
            ]
        },
        "descr": "A resistor is a passive component that reduces voltage or limits the current flowing through a circuit.",
        "bounds": [
            -10,
            -2,
            10,
            2
        ]
    },
    "2": {
        "typeId": 2,
        "name": "capacitor",
        "abbr": "C",
        "turtle": [
            {
                "code": "L",
                "params": [
                    -1,
                    -4,
                    -1,
                    4
                ]
            },
            {
                "code": "L",
                "params": [
                    1,
                    -4,
                    1,
                    4
                ]
            },
            {
                "code": "L",
                "params": [
                    -6,
                    0,
                    -1,
                    0
                ]
            },
            {
                "code": "L",
                "params": [
                    1,
                    0,
                    5,
                    0
                ]
            }
        ],
        "pins": {
            "0": [
                -6,
                0
            ],
            "1": [
                6,
                0
            ]
        },
        "descr": "A capacitor is a passive, two-terminal electronic component that stores electrical energy in an electric field by accumulating charge on two conductive plates separated by an insulating dielectric material",
        "bounds": [
            -6,
            -4,
            5,
            4
        ]
    },
    "3": {
        "typeId": 3,
        "name": "transistor",
        "abbr": "VT",
        "turtle": [
            {
                "code": "L",
                "params": [
                    -11,
                    0,
                    -2,
                    0
                ]
            },
            {
                "code": "L",
                "params": [
                    -2,
                    -4,
                    -2,
                    4
                ]
            },
            {
                "code": "L",
                "params": [
                    2,
                    10.66,
                    2,
                    5.66
                ]
            },
            {
                "code": "L",
                "params": [
                    2,
                    -5.66,
                    2,
                    -10.66
                ]
            },
            {
                "code": "C",
                "params": [
                    0,
                    0,
                    6
                ]
            },
            {
                "code": "L",
                "params": [
                    -2,
                    -1.748,
                    2,
                    -5.66
                ]
            },
            {
                "code": "P",
                "params": [
                    -2,
                    1.749,
                    0.122,
                    2.456,
                    -1.292,
                    3.87,
                    2
                ]
            },
            {
                "code": "L",
                "params": [
                    -2,
                    1.749,
                    2,
                    5.66
                ]
            }
        ],
        "pins": {
            "0": [
                -11,
                0
            ],
            "1": [
                2,
                10.66
            ],
            "2": [
                2,
                -10.66
            ]
        },
        "descr": "A transistor is a fundamental semiconductor device used to amplify or switch electrical signals and power, serving as a building block for modern electronics.",
        "bounds": [
            -11,
            -10.66,
            6,
            10.66
        ]
    },
    "4": {
        "typeId": 4,
        "name": "diode",
        "abbr": "VD",
        "turtle": [
            {
                "code": "P",
                "params": [
                    -2.5,
                    -2.5,
                    2.5,
                    0,
                    -2.5,
                    2.5,
                    1
                ]
            },
            {
                "code": "L",
                "params": [
                    -7.5,
                    0,
                    7.5,
                    0
                ]
            },
            {
                "code": "L",
                "params": [
                    2.5,
                    2.5,
                    2.5,
                    -2.5
                ]
            }
        ],
        "pins": {
            "0": [
                -7.5,
                0
            ],
            "1": [
                7.5,
                0
            ]
        },
        "descr": "A diode is a semiconductor device, typically made of silicon, that essentially acts as a one-way switch for current.",
        "bounds": [
            -7.5,
            -2.5,
            7.5,
            2.5
        ]
    },
    "5": {
        "typeId": 5,
        "name": "test",
        "abbr": "test",
        "turtle": [],
        "pins": {},
        "descr": "test",
        "bounds": [
            null,
            null,
            null,
            null
        ]
    }
}




// connect 2 points 