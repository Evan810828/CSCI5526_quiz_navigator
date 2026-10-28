import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'katex/dist/katex.min.css';
import './styles.css';
class ErrorBoundary extends React.Component<{children:React.ReactNode},{error:string}> {
  state={error:''};
  static getDerivedStateFromError(error:Error){return {error:error.message};}
  render(){return this.state.error?<main className="fatal-error"><h1>The navigator encountered an error.</h1><p>{this.state.error}</p><button onClick={()=>location.reload()}>Reload</button><p>Your original files and saved browser bookmarks have not been changed.</p></main>:this.props.children;}
}
ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><App/></ErrorBoundary>);
