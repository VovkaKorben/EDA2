import React, { useState, useRef } from 'react';
import { prettify } from '../helpers/debug.js';
import { LayerTypes } from '../helpers/utils.js';
import '../css/checkbox.css'
import '../css/flex.css'



const LayersList = ({ layers, layersChanged }) => {

  

    const handleLayersChange = (key, val) => {
        const newLayers = {
            ...layers,
            [key]: val?1:0
        }
        layersChanged?.(newLayers)

    }



    return (
        <>
            {

                Object.keys(LayerTypes).map(l =>


                    <div
                        className='cb-cont frlc'
                        key={l}>
                        <input
                            type="checkbox"
                            id={l}
                            name={l}
                            checked={Object.hasOwn(layers, l) ? layers[l] : true}
                            onChange={(e) => handleLayersChange(l, e.target.checked)}
                        />
                        <label htmlFor={l}>{LayerTypes[l]}</label>
                    </div>

                )
            }
        </>
    )
}
export default LayersList;

