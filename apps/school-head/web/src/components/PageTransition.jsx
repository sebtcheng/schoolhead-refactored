// src/components/PageTransition.jsx
import React from 'react';
import { motion } from 'framer-motion';

const animations = {
    initial: { opacity: 0, y: 18, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit:    { opacity: 0, y: -12, scale: 0.99 }
};

const PageTransition = ({ children }) => {
    return (
        <motion.div
            variants={animations}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{
                duration: 0.45,
                ease: [0.22, 1, 0.36, 1], // custom cubic-bezier: fast start, silky finish
            }}
            className="w-full h-full"
        >
            {children}
        </motion.div>
    );
};

export default PageTransition;