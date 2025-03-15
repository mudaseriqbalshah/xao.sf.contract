import graphviz

def create_deployment_flow():
    dot = graphviz.Digraph('deployment_flow', comment='Contract Deployment Flow')
    dot.attr(rankdir='TB', splines='ortho')

    # Add styling
    dot.attr('node', shape='box', style='rounded,filled', 
            fontname='Arial', fontsize='12', 
            margin='0.2', width='2')
    dot.attr('edge', fontname='Arial', fontsize='10', 
            color='#666666', penwidth='1.5')

    # Define node colors
    colors = {
        'core': '#4CAF50',      # Green for core contracts
        'factory': '#2196F3',   # Blue for factory contracts
        'deploy': '#FFA726',    # Orange for deployment
        'generated': '#7B1FA2'  # Purple for generated contracts
    }

    # Add nodes with colors
    dot.node('deployment', 'Deployment\nManager', fillcolor=colors['deploy'], fontcolor='white')
    dot.node('xao_token', 'XAO Token\nERC20', fillcolor=colors['core'], fontcolor='white')
    dot.node('governance', 'Governance\nDAO Control', fillcolor=colors['core'], fontcolor='white')
    dot.node('treasury', 'Treasury\nFund Management', fillcolor=colors['core'], fontcolor='white')
    dot.node('factory', 'Factory Layer\nContract Generation', fillcolor=colors['factory'], fontcolor='white')
    dot.node('event_factory', 'Event Factory\nEvent Creation', fillcolor=colors['generated'], fontcolor='white')
    dot.node('artist_factory', 'Artist Factory\nArtist Management', fillcolor=colors['generated'], fontcolor='white')

    # Add edges with labels
    dot.edge('deployment', 'xao_token', 'Deploy & Initialize')
    dot.edge('deployment', 'governance', 'Set Permissions')
    dot.edge('deployment', 'factory', 'Configure')
    dot.edge('deployment', 'treasury', 'Set Parameters')
    dot.edge('factory', 'event_factory', 'Generate')
    dot.edge('factory', 'artist_factory', 'Generate')

    # Save the diagram
    dot.render('attached_assets/deployment_flow', format='svg', cleanup=True)

def create_event_creation_flow():
    dot = graphviz.Digraph('event_creation', comment='Event Creation Flow')
    dot.attr(rankdir='LR', splines='curved')

    # Add styling
    dot.attr('node', shape='box', style='rounded,filled',
            fontname='Arial', fontsize='12',
            margin='0.2', width='2')
    dot.attr('edge', fontname='Arial', fontsize='10',
            color='#666666', penwidth='1.5')

    # Define node colors
    colors = {
        'user': '#FF5722',      # Deep Orange
        'factory': '#2196F3',   # Blue
        'contract': '#4CAF50',  # Green
        'explorer': '#9C27B0',  # Purple
    }

    # Add nodes with colors and descriptions
    dot.node('owner', 'Event Owner\nInitiates Creation', fillcolor=colors['user'], fontcolor='white')
    dot.node('event_factory', 'Event Factory\nGenerates Contracts', fillcolor=colors['factory'], fontcolor='white')
    dot.node('parent_event', 'Parent Event\nMain Contract', fillcolor=colors['contract'], fontcolor='white')
    dot.node('event_explorer', 'Event Explorer\nTracking System', fillcolor=colors['explorer'], fontcolor='white')
    dot.node('artist_factory', 'Artist Factory\nArtist Management', fillcolor=colors['factory'], fontcolor='white')
    dot.node('artist_contract', 'Artist Contract\nPerformance Control', fillcolor=colors['contract'], fontcolor='white')

    # Add edges with descriptive labels
    dot.edge('owner', 'event_factory', 'Create Event Request')
    dot.edge('event_factory', 'parent_event', 'Deploy Contract')
    dot.edge('parent_event', 'event_explorer', 'Register Event')
    dot.edge('event_explorer', 'artist_factory', 'Request Artists')
    dot.edge('artist_factory', 'artist_contract', 'Generate Contracts')

    # Save the diagram
    dot.render('attached_assets/event_creation_flow', format='svg', cleanup=True)

def create_ticket_sales_flow():
    dot = graphviz.Digraph('ticket_sales', comment='Ticket Sales Flow')
    dot.attr(rankdir='LR', splines='curved')

    # Add styling
    dot.attr('node', shape='box', style='rounded,filled',
            fontname='Arial', fontsize='12',
            margin='0.2', width='2')
    dot.attr('edge', fontname='Arial', fontsize='10',
            color='#666666', penwidth='1.5')

    # Define node colors
    colors = {
        'user': '#FF5722',      # Deep Orange
        'contract': '#4CAF50',  # Green
        'token': '#FFC107',     # Amber
        'system': '#9C27B0',    # Purple
    }

    # Add nodes with detailed descriptions
    dot.node('buyer', 'Ticket Buyer\nPurchase Request', fillcolor=colors['user'], fontcolor='white')
    dot.node('parent_event', 'Parent Event\nContract\nValidation & Minting', fillcolor=colors['contract'], fontcolor='white')
    dot.node('nft', 'NFT Ticket\nERC1155/721\nOwnership Proof', fillcolor=colors['token'], fontcolor='black')
    dot.node('explorer', 'Event Explorer\nSales Tracking', fillcolor=colors['system'], fontcolor='white')
    dot.node('token', 'XAO Token\nPayment System', fillcolor=colors['token'], fontcolor='black')

    # Add edges with process descriptions
    dot.edge('buyer', 'parent_event', 'Purchase Request')
    dot.edge('parent_event', 'nft', 'Mint Ticket')
    dot.edge('parent_event', 'explorer', 'Update Status')
    dot.edge('nft', 'token', 'Process Payment')

    # Save the diagram
    dot.render('attached_assets/ticket_sales_flow', format='svg', cleanup=True)

def create_revenue_flow():
    dot = graphviz.Digraph('revenue_distribution', comment='Revenue Distribution Flow')
    dot.attr(rankdir='LR', splines='curved')

    # Add styling
    dot.attr('node', shape='box', style='rounded,filled',
            fontname='Arial', fontsize='12',
            margin='0.2', width='2')
    dot.attr('edge', fontname='Arial', fontsize='10',
            color='#666666', penwidth='1.5')

    # Define node colors
    colors = {
        'sale': '#FF5722',      # Deep Orange
        'contract': '#4CAF50',  # Green
        'treasury': '#FFC107',  # Amber
        'system': '#2196F3',    # Blue
        'escrow': '#9C27B0',    # Purple
    }

    # Add nodes with detailed descriptions
    dot.node('ticket_sale', 'Ticket Sale\nRevenue Source', fillcolor=colors['sale'], fontcolor='white')
    dot.node('parent_event', 'Parent Event\nContract\nRevenue Collection', fillcolor=colors['contract'], fontcolor='white')
    dot.node('treasury', 'XAO Treasury\nFund Management', fillcolor=colors['treasury'], fontcolor='black')
    dot.node('splitter', 'Revenue Splitter\nDistribution Logic', fillcolor=colors['system'], fontcolor='white')
    dot.node('escrow', 'Artist Escrow\nSecure Payments', fillcolor=colors['escrow'], fontcolor='white')

    # Add edges with process descriptions
    dot.edge('ticket_sale', 'parent_event', 'Sale Revenue')
    dot.edge('parent_event', 'treasury', 'Collect Funds')
    dot.edge('treasury', 'splitter', 'Calculate Shares')
    dot.edge('splitter', 'escrow', 'Distribute Revenue')

    # Save the diagram
    dot.render('attached_assets/revenue_flow', format='svg', cleanup=True)

def create_arbitration_flow():
    dot = graphviz.Digraph('arbitration', comment='Arbitration Flow')
    dot.attr(rankdir='LR', splines='curved')

    # Add styling
    dot.attr('node', shape='box', style='rounded,filled',
            fontname='Arial', fontsize='12',
            margin='0.2', width='2')
    dot.attr('edge', fontname='Arial', fontsize='10',
            color='#666666', penwidth='1.5')

    # Define node colors
    colors = {
        'user': '#FF5722',      # Deep Orange for users
        'process': '#2196F3',   # Blue for processes
        'system': '#4CAF50',    # Green for system actions
        'storage': '#FFC107',   # Amber for storage
        'decision': '#9C27B0',  # Purple for decisions
        'refund': '#E91E63',    # Pink for refund process
        'payment': '#795548'    # Brown for payment
    }

    # Add nodes with time windows and descriptions
    dot.node('parties', 'Artist/Venue\nDispute Initiators', fillcolor=colors['user'], fontcolor='white')
    dot.node('dispute', 'Dispute Filing\nContract Details', fillcolor=colors['process'], fontcolor='white')
    dot.node('evidence', 'Evidence Collection\n5-Day Window', fillcolor=colors['process'], fontcolor='white')
    dot.node('ipfs', 'IPFS Storage\nSecure Evidence', fillcolor=colors['storage'], fontcolor='black')
    dot.node('ai_review', 'AI Review\nContract Analysis', fillcolor=colors['system'], fontcolor='white')
    dot.node('decision', 'Resolution Options\n- Full Payment\n- Partial Payment\n- Refund\n- Penalties', fillcolor=colors['decision'], fontcolor='white')
    dot.node('appeal', 'Appeal Window\n2-Day Period', fillcolor=colors['decision'], fontcolor='white')
    dot.node('ticket_refund', 'Ticket Refunds\nBatch Processing', fillcolor=colors['refund'], fontcolor='white')
    dot.node('execution', 'Payment Execution\nFund Distribution', fillcolor=colors['payment'], fontcolor='white')

    # Add edges with process descriptions
    dot.edge('parties', 'dispute', 'File Claim')
    dot.edge('dispute', 'evidence', 'Submit Evidence')
    dot.edge('evidence', 'ipfs', 'Store Securely')
    dot.edge('ipfs', 'ai_review', 'Analyze Contract Terms')
    dot.edge('ai_review', 'decision', 'Generate Decision')
    dot.edge('decision', 'appeal', 'Challenge Decision')
    dot.edge('decision', 'ticket_refund', 'If Event Disrupted')
    dot.edge('ticket_refund', 'execution', 'Process Refunds')
    dot.edge('appeal', 'execution', 'Process Payments')
    dot.edge('decision', 'execution', 'Accept Decision')

    # Save the diagram
    dot.render('attached_assets/arbitration_flow', format='svg', cleanup=True)

if __name__ == '__main__':
    # Generate all diagrams
    create_deployment_flow()
    create_event_creation_flow()
    create_ticket_sales_flow()
    create_revenue_flow()
    create_arbitration_flow()