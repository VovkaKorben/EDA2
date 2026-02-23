import React, { useState, useRef } from 'react';
import { prettify } from '../helpers/debug.js';
import { ObjectType } from '../helpers/utils.js';
import '../css/ElementList.css'

const ElementEntry = ({ elem, selected, hovered, selectedChange, hoveredChange, packageChange }) => {
    const [packageSelectorVisible, setPackageSelectorVisible] = useState(false);

    const packageRef = useRef(null);
    const handlePackageSelected = (clear) => {


        setPackageSelectorVisible(false);
        packageChange(
            {
                elementId: elem.elementId,
                packageId: clear ? null : packageRef.current.value
            });
    }




    const classCollect = ['elements-entry', 'frsc'];
    if (selected.type === ObjectType.ELEMENT && selected.elementId === elem.elementId)
        classCollect.push('elements-entry-selected');
    if (hovered.type === ObjectType.ELEMENT && hovered.elementId === elem.elementId)
        classCollect.push('elements-entry-hovered');
    const mergedClass = classCollect.join(' ');

    let packageDisplay;
    if (packageSelectorVisible) {
        // show package selector

        packageDisplay =
            <React.Fragment>
                <select
                    ref={packageRef}
                    className='package-select'
                >
                    {
                        Object.entries(elem.packages).map(p => {

                            return <option
                                key={p[0]}
                                value={p[0]}>
                                {p[1]}
                            </option>
                        })
                    }



                </select>

                {/* confirm package selection */}
                <img
                    src="./ok.svg"
                    onClick={() => handlePackageSelected(false)}
                />

            </React.Fragment>;

    } else {
        // show selected package
        if (elem.packageId) {
            packageDisplay =
                <React.Fragment>
                    <div onClick={() => setPackageSelectorVisible(true)} >
                        {elem.packages[elem.packageId]}
                    </div>

                    {/* clear package */}
                    <img className='img-button'
                        src="./close.svg"
                        onClick={() => handlePackageSelected(true)}
                    />
                </React.Fragment>
        } else {
            // no package
            packageDisplay = <span className='dimmed' onClick={() => setPackageSelectorVisible(true)}>no package</span>
        }
    }

    return <div
        className={mergedClass}
        onMouseEnter={() => hoveredChange({ type: ObjectType.ELEMENT, elementId: elem.elementId })}
        onMouseLeave={() => hoveredChange({ type: ObjectType.NONE })}
        onClick={() => selectedChange(({ type: ObjectType.ELEMENT, elementId: elem.elementId }))}
    >
        <div> {elem.abbr}{elem.typeIndex}</div>
        <div className='package-selector frcc'>{packageDisplay}</div>
    </div>;
}


const ElementsList = ({ schemaElements, libElements, selected, hovered, selectedChange, hoveredChange, packageChange }) => {
    // exit, if library not loaded -
    if (!libElements) return;
    if (Object.keys(libElements).length === 0) return;

    // combine properties from lib and schema
    const elemList = Object.values(schemaElements).map(elem => {
        let e = { ...elem };
        const lib = libElements[elem.typeId];
        if (lib) e = { ...e, ...lib };
        return e;
    });

    // sort by types
    elemList.sort((a, b) => {
        const charCompare = a.abbr.localeCompare(b.abbr);
        return charCompare !== 0 ? charCompare : a.typeIndex - b.typeIndex;
    });


    return (
        <div className="elements-schema">
            {elemList.map((elem) => {
                return <ElementEntry
                    key={elem.elementId}
                    elem={elem}
                    selected={selected}
                    hovered={hovered}
                    selectedChange={selectedChange}
                    hoveredChange={hoveredChange}
                    packageChange={packageChange}
                />

            })


            }

            <code>
                <div className='wr'>
                    selected: {prettify(selected, 1)}<br />
                    hovered: {prettify(hovered, 1)}<br />
                </div>
            </code>

        </div>

    );
};
export default ElementsList;

