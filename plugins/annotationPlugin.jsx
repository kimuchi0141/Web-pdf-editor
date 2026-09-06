import React from 'react';
import { AnnotationLayer } from '../components/AnnotationLayer';

export const annotationPlugin = () => {
    return {
        renderPageLayer: (renderPageProps) => {
            return (
                <AnnotationLayer 
                    pageIndex={renderPageProps.pageIndex}
                    scale={renderPageProps.scale}
                    rotation={renderPageProps.rotation}
                />
            );
        },
    };
};
