import subprocess
from pipeline.agent import Agent



if __name__ == '__main__':
    
    
    agent = Agent('./commits.json')
    agent.run()