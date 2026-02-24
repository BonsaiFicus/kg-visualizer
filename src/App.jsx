import React, { useCallback, useEffect, useRef, useState } from 'react';
import SidebarLeft from './components/SidebarLeft.jsx';
import SidebarRight from './components/SidebarRight.jsx';
import Canvas from './components/Canvas.jsx';
import CanvasCNF from './components/CanvasCNF.jsx';
import Footer from './components/Footer.jsx';
import PopUp from './components/PopUp.jsx';
import LogsModal from './components/LogsModal.jsx';
import useEdgeSwipe from './controls/useEdgeSwipe.js';
import formatGrammar from './algorithm/logging/formatGrammar.js';
import { getGrammarChangeMessage, getAnalyzeModeMessage, getStepPopupMessage } from './algorithm/logging/getInfoMessage.js';
import { stepManager } from './algorithm/steps.js';
import { applyHighlights, buildStepLog, hasProductions, isCNFStage, shouldResetFooter } from './algorithm/logging/stepUiHelpers.js';
import { highlightManager } from './algorithm/rendering/highlightElements.js';
import generateIsProductiveSteps from './algorithm/visualization/step_1_searchProductive.js';

/**
 * Root-Controller fuer die Visualisierung und Analyse einer CFG.
 */
export default function App() {
    const [sidebarLeftOpen, setSidebarLeftOpen] = useState(true);
    const [sidebarRightOpen, setSidebarRightOpen] = useState(false);
    const [sidebarRightLocked, setSidebarRightLocked] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [grammar, setGrammar] = useState({});
    const [analyzeFlag, setAnalyzeFlag] = useState(false);
    const [showCNFCanvas, setShowCNFCanvas] = useState(false);
    const [treeLayout, setTreeLayout] = useState(null);
    const [infoMessage, setInfoMessage] = useState('');
    const [isLogsModalOpen, setIsLogsModalOpen] = useState(false);
    const [currentLogs, setCurrentLogs] = useState([]);
    const [totalLogs, setTotalLogs] = useState([]);
    const [cnfGraph, setCnfGraph] = useState(null);
    const [viewportCenterTrigger, setViewportCenterTrigger] = useState(0);
    const [footerResetTrigger, setFooterResetTrigger] = useState(0);
    const [forceFooterDefault, setForceFooterDefault] = useState(false);
    const lastGrammarChangeSourceRef = useRef('input');

    /**
     * Synchronisiert die CFG-Eingabe mit Logs/Steps der Produktivitaet.
     */
    const handleGrammarChange = useCallback((parsedGrammar, meta = {}) => {
        console.log('App: handleGrammarChange called', parsedGrammar);
        const source = meta?.source || 'input';
        lastGrammarChangeSourceRef.current = source;

        if (shouldResetFooter(source)) {
            setForceFooterDefault(true);
            setFooterResetTrigger(prev => prev + 1);
        }

        if (source === 'input' || source === 'example') {
            setSidebarRightOpen(false);
            setSidebarRightLocked(true);
        } else if (source === 'analyze') {
            setSidebarRightLocked(false);
        }

        if (hasProductions(parsedGrammar)) {
            setGrammar(parsedGrammar);
            const formattedLogs = formatGrammar(parsedGrammar);
            setCurrentLogs(formattedLogs);
            setTotalLogs(formattedLogs);

            if (analyzeFlag) {
                const steps = generateIsProductiveSteps(parsedGrammar);
                stepManager.initializeSteps(steps);
                stepManager.reset();
            }
        } else {
            setSidebarRightOpen(false);
            setSidebarRightLocked(true);
        }

        setInfoMessage(getGrammarChangeMessage(parsedGrammar));
    }, [analyzeFlag]);

    /**
     * Reagiert auf StepManager-Updates der CFG-Analyse.
     */
    const handleStepStatus = useCallback((status) => {
        const currentStep = status.currentStep;
        if (!currentStep) return;

        if (lastGrammarChangeSourceRef.current === 'analyze' && status.totalSteps > 0) {
            setForceFooterDefault(false);
        }

        const shouldShowCNF = isCNFStage(currentStep);
        setShowCNFCanvas(prev => {
            if (prev !== shouldShowCNF) {
                setViewportCenterTrigger(value => value + 1);
            }
            return shouldShowCNF;
        });
        setCnfGraph(shouldShowCNF ? (currentStep.cnfGraph || null) : null);

        setInfoMessage(getStepPopupMessage(currentStep));

        const stepLog = buildStepLog(status, currentStep, grammar);
        applyHighlights(currentStep, grammar);

        setCurrentLogs(stepLog);
        if (status.currentIndex === 0) {
            highlightManager.clearAll();
            setTotalLogs(formatGrammar(grammar));
        } else {
            setTotalLogs(prev => prev + '\n\n' + stepLog);
        }
    }, [grammar]);

    useEffect(() => {
        const unsubscribe = stepManager.subscribe(handleStepStatus);
        return unsubscribe;
    }, [handleStepStatus]);

    /**
     * UI-Handler fuer die linke CFG-Seitenleiste.
     */
    const toggleSidebarLeft = () => {
        setSidebarLeftOpen(prev => {
            const next = !prev;
            if (next && isMobile) setSidebarRightOpen(false);
            return next;
        });
    };

    /**
     * UI-Handler fuer die rechte Log-Seitenleiste zur CFG.
     */
    const toggleSidebarRight = () => {
        setSidebarRightOpen(prev => {
            if (sidebarRightLocked && !prev) return prev;
            const next = !prev;
            if (next && isMobile) setSidebarLeftOpen(false);
            return next;
        });
    };

    /**
     * Oeffnet die Eingabe-Seitenleiste fuer CFG-Steuerung.
     */
    const openSidebarLeft = useCallback(() => {
        setSidebarLeftOpen(true);
        if (isMobile) setSidebarRightOpen(false);
    }, [isMobile]);

    /**
     * Oeffnet die Log-Seitenleiste fuer CFG-Schritte.
     */
    const openSidebarRight = useCallback(() => {
        if (sidebarRightLocked) return;
        setSidebarRightOpen(true);
        if (isMobile) setSidebarLeftOpen(false);
    }, [isMobile, sidebarRightLocked]);

    useEffect(() => {
        const mq = window.matchMedia('(max-width: 900px)');
        const handler = (e) => {
            setIsMobile(e.matches);
            if (e.matches) {
                setSidebarLeftOpen(false);
                setSidebarRightOpen(false);
            }
        };
        handler(mq);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    useEdgeSwipe({
        onOpenLeft: openSidebarLeft,
        onOpenRight: openSidebarRight,
        enableRight: !sidebarRightLocked,
    });

    /**
     * Nimmt Layoutdaten der CFG-Graphstruktur entgegen.
     */
    const handleConnectedProductionsChange = (_productions, _result, layout) => {
        if (layout) setTreeLayout(layout);
    };

    /**
     * Schaltet zwischen Analyse- und Anzeige-Modus der CFG um.
     */
    const handleAnalyzeFlag = (flag) => {
        setAnalyzeFlag(flag);
        setShowCNFCanvas(false);
        setInfoMessage(getAnalyzeModeMessage(flag));
        setForceFooterDefault(!flag);

        console.log('App: analyzeFlag set to', flag);
    };

    /**
     * UI-Handler fuer die CNF-Ansicht der CFG.
     */
    const toggleCNFCanvas = () => {
        setShowCNFCanvas(prev => !prev);
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>KG-Visualizer</h1>
                <div className="header-actions">
                    <button 
                        className="github-button"
                        onClick={() => window.open('https://github.com/BonsaiFicus/kg-visualizer', '_blank')}
                        title="View on GitHub"
                        aria-label="GitHub Repository"
                    >
                        GitHub
                    </button>
                    <button
                        className={`cnf-toggle-button ${showCNFCanvas ? 'active' : ''}`}
                        onClick={toggleCNFCanvas}
                        title={showCNFCanvas ? 'Show Original Grammar' : 'Show CNF'}
                    >
                        {showCNFCanvas ? 'Original' : 'CNF'}
                    </button>
                </div>
            </header>
            <PopUp message={infoMessage} />

            <div className="app-main">
                <SidebarLeft
                    open={sidebarLeftOpen}
                    toggleSidebarLeft={toggleSidebarLeft}
                    onGrammarChange={handleGrammarChange}
                    onAnalyzeFlag={handleAnalyzeFlag}
                ></SidebarLeft>
                <div className="canvas-area">
                    <Canvas
                        grammar={grammar}
                        onConnectedProductionsChange={handleConnectedProductionsChange}
                    ></Canvas>
                    <CanvasCNF
                        grammar={grammar}
                        cnfGraph={showCNFCanvas ? cnfGraph : null}
                        className={showCNFCanvas ? 'canvas-cnf-active' : ''}
                        viewportCenterOn={showCNFCanvas ? viewportCenterTrigger : null}
                    ></CanvasCNF>
                </div>
                <SidebarRight
                    grammar={grammar}
                    open={sidebarRightOpen}
                    locked={sidebarRightLocked}
                    toggleSidebarRight={toggleSidebarRight}
                    onOpenLogsModal={() => setIsLogsModalOpen(true)}
                    currentLogs={currentLogs}
                    onCurrentLogsChange={setCurrentLogs}
                ></SidebarRight>
            </div>

            <LogsModal
                isOpen={isLogsModalOpen}
                onClose={() => setIsLogsModalOpen(false)}
                logs={totalLogs}
            />

            <Footer
                visible={grammar && Object.keys(grammar.productions || {}).length > 0}
                analyzeFlag={analyzeFlag}
                footerResetTrigger={footerResetTrigger}
                forceDefaultFooter={forceFooterDefault}
            />
        </div>
    );
}

