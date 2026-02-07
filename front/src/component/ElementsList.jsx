import React from 'react';
import { prettify } from '../helpers/debug.js';



const ElementsList = ({ schemaElements, libElements, selected, hovered }) => {
    return (
        <React.Fragment>

            {Object.values(schemaElements).map((e) => {
                return <div
                    key={e.id}
                    className='elements-list'
                >
                    {libElements[e.typeId].abbr}{e.typeIndex}
                    {/* {prettify(e,0)} */}

                </div>

            })


            }

            {prettify(selected)}<br />
            {prettify(hovered)}<br />
        </React.Fragment>



    );
};
export default ElementsList;

// <div id="control_panel">
// </div>